$(function() {
	// Suggest school name from freebase
	$("#school").suggest({type:'/education/university'}
).bind("fb-select", function(e, data) {
	var guid = data.guid.substr(1);

	// retrieve the school's website
	var envelope = {
		query: {
			"id": data.id,
			"/common/topic/webpage":[{
				"uri":null,
				"limit": 1
				}]
			}
		};
		$.getJSON("http://api.freebase.com/api/service/mqlread?callback=?",
		{query: JSON.stringify(envelope)},  
		displayURI);

		// Display the website link
		function displayURI(response) {
			if (response.code == "/api/status/ok" && 
			response.result['/common/topic/webpage'][0].uri) { 
				var uri = response.result['/common/topic/webpage'][0].uri; 
				$('#selected-school').attr("href", uri);
			}
		}

		// Retrieve an image of the school's seal 
		var envelope = {                      
			query : {
				"id": data.id,
				"/common/topic/image": [{
					id: null,
					limit: 1 // we need only one image
					}]
				}
			};
			$.getJSON("http://api.freebase.com/api/service/mqlread?callback=?",
			{query: JSON.stringify(envelope)},  
			displayImage);

			// Display the seal
			function displayImage(response) {
				if (response.code == "/api/status/ok" &&        
				response.result['/common/topic/image'][0].id) { 
					var img_src = "http://www.freebase.com/api/trans/raw/" + response.result['/common/topic/image'][0].id; 
					$('#selected img').attr("src", img_src);			
				}
			}		

			// Get mid from guid (guids have been deprecated)
			var envelope = {
				query: {
					"id": data.id,
					"mid": null
				}
			};
			$.getJSON("http://api.freebase.com/api/service/mqlread?callback=?",
			{query: JSON.stringify(envelope)},  
			setMid);

			// set the mid
			function setMid(response) {
				if (response.code == "/api/status/ok") {
                    $('#alumni').append($('<img></img>').attr('src','/styles/loading-large.gif'));
					var mid = response.result.mid;
					// Create a sparql query to get information about the school's alumni
					var sparql = generateAlumniSparqlRequest(mid);

					// DBPedia URI for executing the sparql query. 
					var dbpediaUrl = "http://dbpedia.org/sparql?default-graph-uri=http%3A%2F%2Fdbpedia.org&query=" + escape(sparql) + "&format=json";
					// An ajax request that requests the above URI and parses the response
					$.ajax({
						dataType :'jsonp',
						jsonp :'callback',
						url :dbpediaUrl,
						success : function(json) {
							var dbPediaAlumni = new Array();
							if( json && 
								json.results && 
								json.results.bindings && 
								json.results.bindings.length > 0) {
									bindings = json.results.bindings;
									dbPediaAlumni = parseBindings(bindings);
								}
								$('#alumni').html('');
                                $.each(dbPediaAlumni, function(i, item) {
                                    alum = $('<div class="alum"></div>');
									img = $('<img></img>').attr('src', item.thumb);
									link1 = $('<a class="shownews"></a>').attr('href', '#');
									link1.append(img);
									alum.append(link1);
									span = $('<span></span').text(item.name);
									link2 = $('<a class="showfbase" target="_blank"></a>').attr('href', item.freebaseUri);
                                    link2.append(span);
                                    alum.append(link2);
                                    alumnus = $('<li class="alumnus"></li>').attr('id', 'alumnus_' + i).append(alum);
                                    $('#alumni').append(alumnus);
                                    (function(item) {
                                        $('#alumnus_' + i + ' a.shownews').click(function(event) {
                                            event.preventDefault();
                                            loadNytimesLinkedData(item);
                                            $('html, body').animate({
                                                scrollTop: $('#news').offset().top
                                            }, 300);
                                        });
                                    })(item);
                                });
							}
						});

						// The following method contains code from http://open.blogs.nytimes.com/
						/**
						* This method parses the data requested from DBPedia 
						* about the alumni of a given school.  Since the same Alumnus 
						* may be retured multiple times for a single query, this 
						* method filters out duplicate results.
						*/
						function parseBindings(bindings) {
							var alumni = [];
							var displayIds = [];
							for(var i = 0; i < bindings.length; i++) {
								var binding = bindings[i];
								var bindingUri = binding.alumnus.value;
								if(!(bindingUri in displayIds)) {
									displayIds[bindingUri] = 1;
									var alumnus = new Object;
									alumnus.uri = bindingUri;

									// If we found a freebase URI, use the Freebase 
									// thumbnailing service to generate a thumbnail 
									// image for the alumnus.
									if(binding.freebaseUri) {
										alumnus.thumb = createFreebaseThumbnailUrl(binding.freebaseUri.value);
										alumnus.freebaseUri = binding.freebaseUri.value;
									} else {
										alumnus.thumb = ""; // insert path to default image here
									}
									alumnus.name = binding.name.value;
									alumni.push(alumnus);
								}
							}
							return alumni;
						}

						// The following method contains code from http://open.blogs.nytimes.com/
						/**
						* This method transforms the specific Freebase URI into a request to
						* Freebase's image thumbnailing service.  If such a transformation
						* is not possible, then a default thumbnail URL is returned. 
						*/
						function createFreebaseThumbnailUrl(freebaseUri) {
							var index = freebaseUri.lastIndexOf("/");
							if(index != -1 && index != freebaseUri.length - 1) {
								freebaseUri = freebaseUri.substring(index + 1);
								freebaseUri = freebaseUri.replace(".","/");
								freebaseUri =  
								"http://www.freebase.com/api/trans/image_thumb/m/" + 
								freebaseUri + 
								"?mode=fillcrop&maxwidth=75&maxheight=75&onfail=" + 
								escape(""); // insert path to default image here
								return freebaseUri;
							} 
							return ""; // insert path to default image here
						}

						// Creates a SPARQL query to get alumni and their details from DBPedia 
						function generateAlumniSparqlRequest(mid) {

							// The specific DBPedia relations used to identify 
							// somebody as an alumni or employee of a given school. 
							//called it schoolRelations for lack of a better name
							_schoolRelations = [
                                "dbpprop:almaMater",
                                "dbpprop:education",
                                "dbpprop:alumnus ",
                                "dbpedia-owl:college",
                                "dbpedia-owl:almaMater",
                                "dbpprop:college"
							];

							var sparql = "SELECT * WHERE {";
							for(var i = 0; i < _schoolRelations.length; i++) {
								sparql += "{?alumnus " + _schoolRelations[i] + " ?schoolUri . " +
								"?alumnus dbpprop:name ?name . " +
								"?alumnus owl:sameAs ?freebaseUri FILTER regex(?freebaseUri,'http://rdf\\\\.freebase\\\\.com/.*') . }";
								if(i < _schoolRelations.length - 1) {
									sparql += " UNION ";
								}
							}
							sparql += ". ?schoolUri owl:sameAs <http://rdf.freebase.com/ns" + mid + ">.}";
							return sparql;
						}

						// Get news about alumni 
						// Based on code from http://open.blogs.nytimes.com/
						/**
						* This method loads the linked data at http://data.nytimes.com 
						* for each alumnus discovered by DBPedia for a given school. 
						*
						* This method takes advantage of the JSONP support provided 
						* by http://data.nytimes.com and described at 
						* http://data.nytimes.com/home/about.html
						*/
						function loadNytimesLinkedData(alumnus) {
                            var envelope = {
                                query: {
                                    "mid": alumnus.freebaseUri.substring(26),
                                    "key": [{
                                            "namespace": "/user/jamie/nytdataid",
                                            "value": null
                                            }]
                                    }
                                };
                                $.getJSON("http://api.freebase.com/api/service/mqlread?callback=?",
                                {query: JSON.stringify(envelope)},  
                                processNytId);
                                function processNytId(response) {
                                    $('#news').empty();
                                    $('#news').append($('<h1></h1>').text(alumnus.name + ' in the news.'));
                                    if(response.code == "/api/status/ok" && response.result) {
                                        var nytId = 'http://data.nytimes.com/' + response.result['key'][0].value;
                                        $.ajax( {
                                            dataType :'jsonp',
                                            jsonp :'callback',
                                            url :nytId + ".json",
                                            success : function(json) {
                                                if(json.stat == 'ok') {
                                                    loadAlumnusDetails(json);
                                                }
                                            }
                                        });
                                    }
                                    else {
                                        querySearchApi(alumnus.name, false);
                                    }
                                }
						}

						// Contains code from http://open.blogs.nytimes.com/
						/**
						* This method extracts the "skos:prefLabel" attribute from the 
						* RDF-JSON returned by data.nytimes.com and uses this label to query
						* The New York Times Search API 
						* (details: http://developer.nytimes.com/docs/article_search_api). Please
						* note that the "skos:prefLabel" attribute corresponds to a tag returned
						* by the time tags api (http://developer.nytimes.com/docs/timestags_api). 
						*/
						function loadAlumnusDetails(nytJson) {
							for(var key in nytJson) {
								if(!nytJson[key]["skos:prefLabel"]) {
									continue;
								}
								// Obtain and set the topic page link to an alumnus' 
								// times topics page (more: http://topics.nytimes.com) 
								var topicPageUrl = nytJson[key]["nyt:topicPage"];
								if(topicPageUrl) {
									$('#news').append($('<a></a>').attr('href', topicPageUrl).text('Times page'));
								}
								// Query the NYT search API for the specified facet.
								var facet = nytJson[key]["skos:prefLabel"];
								querySearchApi(facet, true);
								break;
							}
						}

						// This ajax request is handled by our own server because New York Times search api doesn't handle client side callback requests
						function querySearchApi(name, isFaceted) {
							var url = url = "api/search?name="+ escape(name);
							if(isFaceted) {
								url = url + "&facet=per_facet";
							}
							$.ajax( {
								dataType :'json',
								json :'callback',
								url : url,
								success : function(json) {
									if(json.results) {
										// Display news articles
										displayAlumnusDetails(json);
									}
								}
							});
						}

						/**
						* Renders the output of The New York Times search API as HTML.
						*/
						function displayAlumnusDetails(json) {
							var results = json.results;
							var html = "";
							for(var i =0; i < results.length; i++) {
								var id = i;
								var result = results[i];
								var headline = result.title;
								var date = result.date;
								var url = result.url;
								var abstract_text = result.body;
								var byline = result.byline;
								var thumbnail = result.small_image_url;
								var divId = "headline_" + i; 
								var articleDivId = 'article_' + i;
								html += 
								"<div class='news-article'><div id = '" + 
								divId + 
								"' class='list_headline'><a href='" + url + "' target='_blank'>" + 
								headline + 
								"<\/a>&nbsp;-&nbsp;<span class ='list_dateline'>" + 
								formatDate(date) + 
								"<\/span><\/div>";
								html += '<div id = "'  + articleDivId + '" class="article ' + articleDivId + '_class">';
								if(byline != null) {
									html += '<div class="byline">'+byline+'<\/div>';
								}
								if(abstract_text != null) {
									html += '<div class="abstract_text">'+abstract_text+' ...<\/div>';
								}
								html += '<\/div><\/div>';
							}
							// Display the HTML for a given alumnus.
							$('#news').append(html);
						}

						// Code from http://open.blogs.nytimes.com/
						/**
						* Function that converts a date in YYYY-MM-DD format to written format.
						* For example this method would convert 1979-08-07 to 'August 7, 1979.
						*/
						function formatDate(date) {
							date = date + "";
							if(date.length == 8) {
								year = date.substr(0,4);
								month = date.substr(4,2);
								day = date.substr(6,2);
								if(month == '01') {
									month = 'January';
								} else if(month == '02') {
									month = 'February';
								} else if(month == '03') {
									month = 'March';
								} else if(month == '04') {
									month = 'April';
								} else if(month == '05') {
									month = 'May';
								} else if(month == '06') {
									month = 'June';
								} else if(month == '07') {
									month = 'July';
								} else if(month == '08') {
									month = 'August';
								} else if(month == '09') {
									month = 'September';
								} else if(month == '10') {
									month = 'October';
								} else if(month == '11') {
									month = 'November';
								} else if(month == '12') {
									month = 'December';
								}
								date = month + " " + day + ", " + year; 
							}
							return date;
						}   
					}
				}
				//}
				//});
			});
		});
