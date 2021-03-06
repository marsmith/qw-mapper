// ------------------------------------------------------------------------------
// ----- NY QW Mapper ----------------------------------------------------------
// ------------------------------------------------------------------------------

// copyright:   2016 Martyn Smith - USGS NY WSC

// authors:  Martyn J. Smith - USGS NY WSC

// purpose:  Web Mapping interface for NY QW data

// updates:
// 12.02.2016 mjs - Created

//config variables
var MapX = '-76.2';
var MapY = '42.7';
var map;
var sitesGeoJSON;  //master geoJSON object of universe of sitesGeoJSON
var sitesLayer;  //leaflet feature group representing current filtered set of sites
var baseMapLayer, basemapLayerLabels;
var filterGroupList = ['County','HUC', 'Aquifer', 'WellDepth'];
var geojsonMarkerOptions = {
	radius: 4,
	fillColor: '#ff7800',
	color: '#000',
	weight: 1,
	opacity: 1,
	fillOpacity: 0.8
};
var geoFilterFlag;
var parentArray = [];

var layerList = [
	{layerID: "1", layerName: "NY WSC Sub-district", outFields: ["subdist","FID"],dropDownID: "WSCsubDist"},
	{layerID: "2", layerName: "Senate District", outFields: ["NAMELSAD","FID","Rep_Name"],dropDownID: "SenateDist"},
	{layerID: "3", layerName: "Assembly District", outFields: ["NAMELSAD","FID","AD_Name"], dropDownID: "AssemDist"},
	{layerID: "4", layerName: "Congressional District",	outFields: ["NAMELSAD","FID","CD_Name"], dropDownID: "CongDist"},
	{layerID: "5", layerName: "County",	outFields: ["County_Nam","FID"],dropDownID: "County"},
	{layerID: "6", layerName: "Hydrologic Unit",	outFields: ["HUC_8","FID","HU_8_Name"],	dropDownID: "HUC8"}	
];

var allLayers = [
    {
        "groupHeading": "Filters",
        "showGroupHeading": true,
        "includeInLayerList": true,
        "layers": {
			"USGS Sub-district" : {
                "url": "https://www.sciencebase.gov/arcgis/rest/services/Catalog/56ba63bae4b08d617f6490d2/MapServer",
				"layers": [1,2,3,4,5,6], 
				"visible": false, 
				"opacity": 0.8,
                "wimOptions": {
                    "type": "layer",
                    "layerType": "agisDynamic",
                    "includeInLayerList": true
                }
            }
        }
    }
];

toastr.options = {
  'positionClass': 'toast-bottom-right',
}

if (process.env.NODE_ENV !== 'production') {
  require('../index.html');
}

//instantiate map
$( document ).ready(function() {
	console.log('Application Information: ' + process.env.NODE_ENV + ' ' + 'version ' + VERSION);
	$('#appVersion').html('Application Information: ' + process.env.NODE_ENV + ' ' + 'version ' + VERSION);

	//create map
	map = L.map('mapDiv',{zoomControl: false});

	//add zoom control with your options
	L.control.zoom({position:'topright'}).addTo(map);  
	L.control.scale().addTo(map);

	//basemap
	layer= L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
		attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
		maxZoom: 16
	}).addTo(map);

	//set initial view
	map.setView([MapY, MapX], 7);
		
	//define layers
	sitesLayer = L.featureGroup().addTo(map);

	//createFilterGroups();
	parseBaseLayers();
	loadSites();
	
	/*  START EVENT HANDLERS */
	$('#mobile-main-menu').click(function() {
		$('body').toggleClass('isOpenMenu');
	});

	$('.basemapBtn').click(function() {
		$('.basemapBtn').removeClass('slick-btn-selection');
		$(this).addClass('slick-btn-selection');
		var baseMap = this.id.replace('btn','');
		setBasemap(baseMap);
	});

	$('#loadSites').click(function() {
		loadSites();
	});

	$('#resetView').click(function() {
		resetView();
	});

	$('#resetFilters').click(function() {
		resetFilters();
	});


	$('#aboutButton').click(function() {
		$('#aboutModal').modal('show');
	});	

	$('#getQWdata').click(function() {
		getQWdata();
	});	

	$('#exportGeoJSON').click(function() {
		downloadGeoJSON();
	});	

	$('#exportKML').click(function() {
		downloadKML();
	});	

	$('.NWISselect').on('change', function() {
		var selectName = $('option:selected',this).parent().attr('id');
		var optionName = $('option:selected',this).text();
		var optionValue = $('option:selected',this).attr('value');
		var filterInfo = {selectName:selectName, optionName:optionName, optionValue:optionValue};	
		filterSites(filterInfo);
	});

	$('#geoFilterSelect').on('changed.bs.select', function (event, clickedIndex, newValue, oldValue) {
		console.log('testing if this works',event.target, clickedIndex, newValue, oldValue);

		var parentSelectID = $(event.target).attr('id');
		var selectArray = $(event.target).find("option:selected");
		var singleSelectCount = selectArray.length;
		var currentSelected = $(event.target).find("option")[clickedIndex];

		console.log('current selected: ', currentSelected, parentSelectID )

		if (selectArray.length == 0) {
			console.log('here',parentSelectID,parentArray)
			var index = parentArray.indexOf(parentSelectID);
			if (index > -1) {
				parentArray.splice(index, 1);
			}
		}

		//if operation is a deselect, get remaining selected options
		if (newValue == false) {
			var layerID = $(this).find("option:selected").attr('layerID');
			var value = $(this).find("option:selected").attr('value');
			var name = $(event.target).find("option:selected").text();
		}

		//otherwise make a new selection
		else {
			var layerID = $(currentSelected).attr('layerID');
			var value = $(currentSelected).attr('value');
			var name = $(currentSelected).text();
		}


		console.log('GeoFilter selected: ',name,value,layerID,parentSelectID,singleSelectCount);

		//find how many different selects have options selected
		$.each($('#geoFilterSelect').find("option:selected"), function (index,value) {
			var parent = $(value).parent().attr('id');
			if (parentArray.indexOf(parent) == -1) {
				parentArray.push(parent);
			}
		});
		console.log('geoselect with selections in:',parentArray);
		

		//if all in a single select are unselected, reset filters
		if (singleSelectCount == 0 && parentArray.length == 0) {
			toastr.info('You just unselected all options, resetting filters', 'Info');
			//resetFilters();
		}

		//otherwise do query
		else {

			//make sure there is a selection
			if (layerID) {

				//single select query
				var query = "FID = " + value;

				//if this is a multiple selection from the same select, add to current select
				if (singleSelectCount > 1) {

					//NEW METHOD HERE 'FID IN (1,2,3)'
					query = $(selectArray).map(function() {
						return "FID = " + this.value;
					}).get().join(' or ');	
				}

				console.log('running quere where:',query);
				toastr.info(parentSelectID + ' equals ' + name, 'Querying sites where... ');

				mapServer.query().layer(layerID).returnGeometry(true).where(query).run(function(error, clipPolygonGeoJSON){

					//make sure there is a result polygon
					if (clipPolygonGeoJSON.features.length > 0) {

						//logic here is if there are selections from multiple dropdowns, then
						//use the currently selected set to do the clip
						if (parentArray.length > 1) {
							var inputSitesGeoJSON = sitesLayer.toGeoJSON().features[0];
							var ptsWithin = clipSites(inputSitesGeoJSON, clipPolygonGeoJSON);
						}

						//otherwise, use the master list of sites
						else {
							var ptsWithin = clipSites(sitesGeoJSON, clipPolygonGeoJSON);
						}

						if (ptsWithin) {
							geoFilterFlag = true;
							drawGeoJSON(ptsWithin)
						}
						else {
							//if no sites returned from clip, unselect this from select
							console.log('here',currentSelected, $(currentSelected).prop("selected"))
							$(currentSelected).prop("selected", false);
							$('.selectpicker').selectpicker('refresh');

						}
						

					}
					else {
						toastr.error('Error', 'Geometry query did not return any features');
					}
				});
			}
		}
	});

	$('#geoFilterSelect').on('change', '.selectpicker', function() {
	//$(document).on('change', '.geoFilterSelect', function() {
		

	});

	/*  END EVENT HANDLERS */
});

function drawGeoJSON(geoJSON) {
	//clear current display layer
	sitesLayer.clearLayers();

	var geoJSONlayer = L.geoJson(geoJSON, {
		// //optional filter input
		// filter: function(feature, layer) {
		// 	if (filterInfo.selectName === 'CountySelect') return feature.properties.countyCode === filterInfo.optionValue;
		// 	if (filterInfo.selectName === 'HUCSelect') return feature.properties.hucCode === filterInfo.optionValue;
		// 	if (filterInfo.selectName === 'AquiferSelect') return feature.properties.aquiferCode === filterInfo.optionValue;
		// 	if (filterInfo.selectName === 'WellDepthSelect') return feature.properties.wellDepth === filterInfo.optionValue;
		// },
		pointToLayer: function (feature, latlng) {
			return L.circleMarker(latlng, geojsonMarkerOptions);
		},
		onEachFeature: function (feature, layer) {
			//layer.bindPopup('<b>' + feature.properties.siteID + '</b></br></br>' + feature.properties.siteName + '</br><a href="https://waterdata.usgs.gov/nwis/inventory/?site_no=' + feature.properties.siteID + '" target="_blank">Access Data</a></br></br>');
			var $popupContent = $('<div>', { id: 'popup' });

			$.each(feature.properties, function( index, property ) {
				$popupContent.append('<b>' + index + ':</b>  ' + property + '</br>')
			});
			
			layer.bindPopup($popupContent.html());
		}
	});
	sitesLayer.addLayer(geoJSONlayer);
	map.fitBounds(sitesLayer.getBounds());
}

function resetFilters() {
	$('.selectpicker').selectpicker('deselectAll');

	parentArray = [];

	resetView();

	drawGeoJSON(sitesGeoJSON)
}

function parseBaseLayers() {
	$.each(allLayers, function (index,group) {
		console.log('processing: ', group.groupHeading)

		//sub-loop over layers within this groupType
		$.each(group.layers, function (mapServerName,mapServerDetails) {

			// if (mapServerDetails.wimOptions.layerType === 'agisFeature') {	
			// 	featureLayer = L.esri.featureLayer({url:mapServerDetails.url});
			// 	//addLayer(group.groupHeading, group.showGroupHeading, layer, mapServerName, mapServerDetails);
			// }

			if (mapServerDetails.wimOptions.layerType === 'agisDynamic') {
				mapServer = L.esri.dynamicMapLayer(mapServerDetails);
				// addMapLayer(mapServer, mapServerName, mapServerDetails);
				
				setupGeoFilters(layerList);
			}
		
		});  
	});
}

function setupGeoFilters(layerList) {
	
	$.each(layerList, function(index,value) {

		toastr.info(value.layerName, 'Getting geoFilters:');
		
		//execute the query task then populate the dropdown menu with list
		mapServer.query().layer(value.layerID).returnGeometry(false).where("1=1").run(function(error, featureCollection){

			if (featureCollection && featureCollection.features.length > 0) {

				//append a new dropdown
				$("#geoFilterSelect").append("<select id='" + value.dropDownID + "' class='selectpicker geoFilterSelect' multiple data-selected-text-format='count' data-dropup-auto='false' title='" + value.layerName + "'></select>");

				var features = featureCollection.features;             
				for(var i=0; i<features.length;i++){
					//console.log('adding: ',features[i].properties[value.outFields[0]], 'to the div: ',value.dropDownID);
					
					$("#" + value.dropDownID).append( $('<option></option>').attr('layerID',value.layerID).val(features[i].properties[value.outFields[1]]).html(features[i].properties[value.outFields[0]]) );
				}
				//sort the options list 
				$("#" + value.dropDownID).html($("#" + value.dropDownID + " option").sort(function (a, b) {
					return a.text == b.text ? 0 : a.text < b.text ? -1 : 1
				}))
				//add the default option
				//$("#" + value.dropDownID).prepend("<option layerID='' selected='selected'>Select a " + value.layerName + "</option>");
				$('.selectpicker').selectpicker('refresh');
			}
			else {
				toastr.error(error.message, 'Error getting geoFilter list for ' + value.layerName);
			}

		});
		//break the loop for testing
		//return false;
	});
}

function clipSites(inputGeoJSON, polyGeoJSON) {

	//console.log('selected: ', filterInfo);
	toastr.info('Filtering sites...', {timeOut: 0});
	
	//turfjs clip operation
	var ptsWithin = within(inputGeoJSON , polyGeoJSON);

	console.log('clip result features:',ptsWithin.features.length);

	if (ptsWithin.features.length > 0) {
		toastr.clear();
		return ptsWithin;
	}

	else {
		toastr.clear();
		toastr.error('Error', 'No sites to display');
		return null;
	}	
}

function summarizeSites(featureCollection) {

	//get the first feature and add to map 
	if(featureCollection.features.length > 0){
		
		$.each(featureCollection.features, function (index,value) {
			
			console.log(index,value);

			
		});
	}
}

function filterSites(filterInfo) {

	//console.log('selected: ', filterInfo);
	toastr.info('Filtering sites...', {timeOut: 0});

	//pass in filter info as optional param
	drawGeoJSON(siteGeoJSON); //NEED TO UPDATE THIS IF USING
	toastr.clear();
}

function loadSites() {

	//reset geo Filter flag
	geoFilterFlag = false;

	sitesLayer.clearLayers();
	sitesGeoJSON = {'type': 'FeatureCollection','features': []};
	toastr.info('Querying NWIS...', {timeOut: 0});

    $.ajax({
		//url: 'https://nwis.waterdata.usgs.gov/ny/nwis/qwdata?site_tp_cd=GW&format=sitefile_output&sitefile_output_format=xml&column_name=agency_cd&column_name=site_no&column_name=station_nm&column_name=dec_lat_va&column_name=dec_long_va&column_name=county_cd&column_name=huc_cd&column_name=aqfr_cd&column_name=well_depth_va&inventory_output=0&rdb_inventory_output=file&TZoutput=0&pm_cd_compare=Greater%20than&radio_parm_cds=all_parm_cds&qw_attributes=0&qw_sample_wide=wide&rdb_qw_attributes=0&date_format=YYYY-MM-DD&rdb_compression=file&list_of_search_criteria=site_tp_cd&column_name=site_tp_cd&column_name=dec_lat_va&column_name=dec_long_va&column_name=agency_use_cd'
		url: './qwdataAll.xml', 
		dataType: 'xml', 
		success: function(xml) {

			toastr.clear();
			toastr.info('Parsing sites...', {timeOut: 0});
			
        	$(xml).find('site').each(function(){

				//get properties
				var siteID = $(this).find('site_no').text();
				var siteName = $(this).find('station_nm').text();
				var latDD = $(this).find('dec_lat_va').text();
				var lonDD = $(this).find('dec_long_va').text();
				var agencyCode = $(this).find('agency_cd').text();
				var countyCode = $(this).find('county_cd').text();
				var hucCode = $(this).find('huc_cd').text();
				var aquiferCode = $(this).find('aqfr_cd').text();
				var wellDepth = $(this).find('well_depth_va').text();

				var siteGeoJSON = {
					'type':'Feature',
					'properties':{
						'siteID':siteID,
						'siteName':siteName,
						'latDD':latDD,
						'lonDD':lonDD,
						'agencyCode':agencyCode,
						'countyCode':countyCode,
						'hucCode':hucCode,
						'aquiferCode':aquiferCode,
						'wellDepth':wellDepth,
					},
					'geometry':{
						'type':'Point',
						'coordinates':[parseFloat(lonDD),parseFloat(latDD)]
					}
				};

				sitesGeoJSON.features.push(siteGeoJSON);

				// //add to select dropdown
				// $.each(filterGroupList, function(index, filterName) {
				// 	if (filterName !== 'WellDepth' && filterName !== 'County') {
				// 		var elementName = '#' + filterName + 'Select';
				// 		var code;
				// 		if (filterName === 'HUC') {code = hucCode};
				// 		if (filterName === 'Aquifer') {code = aquiferCode};
				// 		if (filterName === 'WellDepth') {code = wellDepth};

				// 		//console.log('here', filterName,code)

				// 		//add it if it doesn't exist
				// 		if (code && $(elementName + ' option[value="' + code + '"]').length == 0) {
				// 			//console.log('adding an option for:',elementName,code)
				// 			$(elementName).append($('<option></option>').attr('value',code).text(code));
				// 		}
				// 	}
				// });
			});

			toastr.clear();
			toastr.info('Drawing GeoJSON...', {timeOut: 0});
		
			drawGeoJSON(sitesGeoJSON);

			console.log(sitesGeoJSON.features.length, 'sites loaded');
			toastr.clear();

			//is there a better way to do this?
			$('#sitesPanel').collapse("toggle");
			$('#filtersPanel').collapse("toggle");
   		}
	});
}

function loadSites2() {

	$.getJSON('./siteData.json', function(data) {
		drawGeoJSON(data)
	});
}

function parseFeatureProperties(properties) {
	$.each(properties, function( filterCategory, filterData ) {

		var wellElement = '#' + filterCategory;
		if (typeof filterData === 'object' && $(wellElement).length == 0) {
			$('#filters').append('<div class="well" id="' + filterCategory + '"><h5>' + filterCategory + '</h5></div>');
		}

		$.each(filterData, function( filterName, filterItem ) {
			var elementName = '#' + filterName + 'Select';
			console.log('here2',filterName,filterItem,elementName, $(elementName).length )
			// if ($(elementName).length == 0) {
			// 	console.log(elementName, 'does not exist yet')

			// 	//first create the dropdown
			// 	$(wellElement).append('<select class="form-control" id="' + filterName + 'Select"><option selected="selected" value="default">Select a ' + filterName + '</option></select>');
			
			// 	//then append the value
			// 	$(elementName).append($('<option></option>').attr('value',filterItem).text(filterItem));
			// }
			// else {
			// 	console.log(elementName, 'EXISTS')

			// 	//just append the value
			// 	$(elementName).append($('<option></option>').attr('value',filterItem).text(filterItem));
			// }
		});

	});
}

function addFilterOptions(properties) {
	//add county to dropdown
	if (properties.countyCode) {
		if (checkSelectForItem('#CountySelect',properties.countyCode) == false) {
			$('#CountySelect').append($('<option></option>').attr('value',properties.countyCd).text(properties.countyCd));
		}
		
		// if (properties.countyCode === 'County') {
		// 	//from here: https://www.census.gov/geo/reference/codes/cou.html
		// 	//then converted to json: https://www.csvjson.com/csv2json
		// 	$.getJSON('./countyCodesNY.json', function(data) {
		// 		$.each(data, function( index, county ) {
		// 			var elementName = '#' + filterName + 'Select';
		// 			$(elementName).append($('<option></option>').attr('value',county.CountyCd).text(county.CountyName.replace(' County','')));
		// 		});
		// 	});
		// }
	}
}

function checkSelectForItem(select,item) {
	var exists = false;
	$(select + ' option').each(function(){
		if (this.value === item) {
			exists = true;
			return false;
		}
	});
	return exists;
}

function createFilterGroups() {
	$.each(filterGroupList, function(index, filterName) {

		//only county for now
		if (filterName === 'County') {
			$('#filters').append('<select class="selectpicker NWISselect" multiple id="' + filterName + 'Select"></select>');
			
			//county is special case so we need a lookup file with codes, other ones get populated in createSites
			if (filterName === 'County') {
				//from here: https://www.census.gov/geo/reference/codes/cou.html
				//then converted to json: https://www.csvjson.com/csv2json
				$.getJSON('./countyCodesNY.json', function(data) {
					$.each(data, function( index, county ) {
						var elementName = '#' + filterName + 'Select';
						$(elementName).append($('<option></option>').attr('value',county.CountyCd).attr('stateCounty',county.StateCd + county.CountyCd).text(county.CountyName.replace(' County','')));
						$('.selectpicker').selectpicker('refresh');
					});
				});
			}
		}
	});
}

function getQWdata() {
	//https://stackoverflow.com/questions/35125036/export-leaflet-map-to-geojson

	toastr.info('Getting QW Data...', {timeOut: 0});

	var inputGeoJSON = sitesLayer.toGeoJSON();
	var tempGeoJSON = {'type': 'FeatureCollection','features': []};

	//after we get a copy of current filter, clear the display
	sitesLayer.clearLayers();

	if (inputGeoJSON.features.length > 0) {
		console.log('querying NWIS...');

		var stateCounty = $('#CountySelect :selected').attr('stateCounty');
		var paramCodes = $('#parameterCodes').val();
		var paramCodesArray = paramCodes.split(',');

		var params = { 
			'site_tp_cd': 'GW',
			'param_cd_operator': '',
			'group_key': 'NONE', 
			'sitefile_output_format': 'html_table',
			'column_name': 'agency_cd',
			'column_name': 'site_no',
			'column_name': 'station_nm',
			'inventory_output': 0,
			'rdb_inventory_output': 'file',
			'begin_date': '',
			'end_date': '',
			'TZoutput': 0,
			'pm_cd_va_search': '',
			'pm_cd_compare': 'Greater%20than',
			'pm_cd_result_va': '',
			'radio_parm_cds': 'previous_parm_cds',
			'radio_previous_parm_cds': '',
			'radio_multiple_parm_cds': '',
			'radio_parm_cd_file': '',		
			'qw_attributes': 0,
			'format': 'rdb',
			'qw_sample_wide': 'wide',
			'rdb_qw_attributes': 0,
			'date_format': 'YYYY-MM-DD',
			'rdb_compression': 'value'
		};

		//seperate method if we have a geoFilter
		if (geoFilterFlag) {
			//var inputFile = 'site_no\n430138074044601\n425851074085801\n425731074172901\n';

			var inputFile = 'site_no\n';

			//get list of siteIDs and write it out to a string
			$.each(inputGeoJSON.features[0].features, function( index, feature ) {
				inputFile += feature.properties.siteID + '\n';
			});

			//inputFile = encodeURIComponent(inputFile);

			//add method specific params

			params.multiple_parameter_cds = (paramCodes ? paramCodes : '00940');
			params.list_of_search_criteria = 'site_no_file_attachment,multiple_parameter_cds,site_tp_cd';
			params.site_no_file_attachment = {
				type: 'text/plain',
				filename: 'sites.txt',
				content: inputFile
			}

			// var params = { 
			// 	'site_no_file_attachment': {
			// 		type: 'text/plain',
			// 		filename: 'sites.txt',
			// 		content: inputFile
			// 	},
			// 	'multiple_parameter_cds': (paramCodes ? paramCodes : '00940'),
			// 	'group_key': 'NONE', 
			// 	'sitefile_output_format': 'html_table',
			// 	'column_name': 'agency_cd',
			// 	'column_name': 'site_no',
			// 	'column_name': 'station_nm',
			// 	'inventory_output': 0,
			// 	'rdb_inventory_output': 'file',
			// 	'begin_date': '',
			// 	'end_date': '',
			// 	'TZoutput': 0,
			// 	'pm_cd_va_search': '',
			// 	'pm_cd_compare': 'Greater%20than',
			// 	'pm_cd_result_va': '',
			// 	'radio_parm_cds': 'previous_parm_cds',
			// 	'radio_previous_parm_cds': '',
			// 	'param_cd_operator': '',
			// 	'radio_multiple_parm_cds': '',
			// 	'radio_parm_cd_file': '',
			// 	'qw_attributes': 0,
			// 	'format': 'rdb',
			// 	'qw_sample_wide': 'wide',
			// 	'rdb_qw_attributes': 0,
			// 	'date_format': 'YYYY-MM-DD',
			// 	'rdb_compression': 'value',
			// 	'list_of_search_criteria': 'site_no_file_attachment,multiple_parameter_cds'
			// }

			//console.log(JSON.stringify(params));

			var boundary = '-----------------------------' +
						Math.floor(Math.random() * Math.pow(10, 8));

			var content = [];
			for(var i in params) {
				content.push('--' + boundary);

				var mimeHeader = 'Content-Disposition: form-data; name="'+i+'"; ';
				if(params[i].filename)
					mimeHeader += 'filename="'+ params[i].filename +'";';
				content.push(mimeHeader);

				if(params[i].type)
					content.push('Content-Type: ' + params[i].type);

				content.push('');
				content.push(params[i].content || params[i]);
			};

			content.push('--' + boundary);

			/* Use your favorite toolkit here */
			/* it should still work if you can control headers and POST raw data */
			$.ajax({
				type:'POST',
				url: 'https://nwis.waterdata.usgs.gov/ny/nwis/qwdata',
				data: content.join('\r\n'),
				headers: {
					'Content-Type': 'multipart/form-data; boundary=' + boundary
				},
				cache:false,
    			processData:false,
				contentType: false,
				success: function(d) {

					var qwdata = USGSrdb2JSON(d);
					console.log('got a response:',qwdata.length, 'sites');

					$.each(inputGeoJSON.features[0].features, function( index, feature ) {

						//create a new feature
						var siteGeoJSON = feature;
						var matchFound = false;
					
						//loop over qw results
						$.each(qwdata, function( index, qwSite ) {

							//check for a match
							if (feature.properties.siteID === qwSite.site_no) {

								$.each(paramCodesArray, function( index, paramCode ) {
									if(qwSite.hasOwnProperty('p' + paramCode)){
										siteGeoJSON.properties['p' + paramCode + '|' + qwSite.sample_dt + ' ' + qwSite.sample_tm + ' ' + qwSite.sample_start_time_datum_cd + '|' + qwSite.medium_cd] = qwSite['p' + paramCode];
									}
								});

								//console.log(siteGeoJSON.properties);
								
								matchFound = true;
								//console.log('match found:', qwSite);
							}
						});

						if (matchFound) {
							tempGeoJSON.features.push(siteGeoJSON);
						}
					});

					drawGeoJSON(tempGeoJSON);

					console.log(tempGeoJSON.features.length, 'sites loaded');
					toastr.clear();

					//is there a better way to do this?
					$('#filtersPanel').collapse("toggle");
					$('#exportPanel').collapse("toggle");
				},
			});
		}

		//otherwise regular paramater request method
		else {

			$.ajax({
				url: 'https://nwis.waterdata.usgs.gov/ny/nwis/qwdata', 
				data: { 
					'county_cd': (stateCounty ? stateCounty : ''),
					'site_tp_cd': 'GW',
					'group_key': 'NONE', 
					'sitefile_output_format': 'html_table',
					'column_name': 'agency_cd',
					'column_name': 'site_no',
					'column_name': 'station_nm',
					'inventory_output': 0,
					'rdb_inventory_output': 'file',
					'TZoutput': 0,
					'pm_cd_compare': 'Greater%20than',
					'radio_parm_cds': 'parm_cd_list',
					'radio_multiple_parm_cds': (paramCodes ? paramCodes : '00940'),
					'qw_attributes': 0,
					'format': 'rdb',
					'qw_sample_wide': 'wide',
					'rdb_qw_attributes': 0,
					'date_format': 'YYYY-MM-DD',
					'rdb_compression': 'YYYY-MM-DD',
					'list_of_search_criteria': 'site_tp_cd',
				},
				dataType: 'text', 
				success: function(d) {

					
					var qwdata = USGSrdb2JSON(d);
					console.log('got a response:',qwdata.length, 'sites');

					$.each(inputGeoJSON.features[0].features, function( index, feature ) {

						//create a new feature
						var siteGeoJSON = feature;
						var matchFound = false;
					
						//loop over qw results
						$.each(qwdata, function( index, qwSite ) {

							//check for a match
							if (feature.properties.siteID === qwSite.site_no) {

								$.each(paramCodesArray, function( index, paramCode ) {
									if(qwSite.hasOwnProperty('p' + paramCode)){
										siteGeoJSON.properties['p' + paramCode + '|' + qwSite.sample_dt + ' ' + qwSite.sample_tm + ' ' + qwSite.sample_start_time_datum_cd + '|' + qwSite.medium_cd] = qwSite['p' + paramCode];
									}
								});

								//console.log(siteGeoJSON.properties);
								
								matchFound = true;
								//console.log('match found:', qwSite);
							}
						});

						if (matchFound) {
							tempGeoJSON.features.push(siteGeoJSON);
						}
					});

					drawGeoJSON(tempGeoJSON)

					console.log(tempGeoJSON.features.length, 'sites loaded');
					toastr.clear();

					//is there a better way to do this?
					$('#filtersPanel').collapse("toggle");
					$('#exportPanel').collapse("toggle");
				}	
			});
		}
	}
	else {
		toastr.error('Error', 'No sites to display')
	}
}

function jsonToTable(json) {

    var table = $('<table border=1>');
    var tblHeader = '<tr>';
    for (var k in json[0]) tblHeader += '<th>' + k + '</th>';
    tblHeader += '</tr>';
    $(tblHeader).appendTo(table);
    $.each(json, function (index, value) {
        var TableRow = '<tr>';
        $.each(value, function (key, val) {
            TableRow += '<td>' + val + '</td>';
        });
        TableRow += '</tr>';
        $(table).append(TableRow);
    });
    return ($(table));
};

function downloadGeoJSON() {

	//for some reason the leaflet toGeoJSON wraps the geojson in a second feature collection
	if (sitesLayer.toGeoJSON().features[0]) {
		var GeoJSON = JSON.stringify(sitesLayer.toGeoJSON().features[0]);
		var filename = 'data.geojson';
		downloadFile(GeoJSON,filename)
	}
	else {
		toastr.error('Error', 'No sites to export')
	}
}

function downloadKML() {
	//https://github.com/mapbox/tokml
	//https://gis.stackexchange.com/questions/159344/export-to-kml-option-using-leaflet
	if (sitesLayer.toGeoJSON().features[0]) {
		var GeoJSON = sitesLayer.toGeoJSON().features[0];
		var kml = tokml(GeoJSON);
		var filename = 'data.kml';
		downloadFile(kml,filename);
	}
	else {
		toastr.error('Error', 'No sites to export')
	}
}

function downloadFile(data,filename) {
	var blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
	if (navigator.msSaveBlob) { // IE 10+
		navigator.msSaveBlob(blob, filename);
	} else {
		var link = document.createElement('a');
		var url = URL.createObjectURL(blob);
		if (link.download !== undefined) { // feature detection
			// Browsers that support HTML5 download attribute
			link.setAttribute('href', url);
			link.setAttribute('download', filename);
			link.style.visibility = 'hidden';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		}
		else {
			window.open(url);
		}
	}
}

function USGSrdb2JSON(tsv){

	var lines=tsv.split(/\r?\n/);
	var result = [];
	var headers;

	$.each(lines, function( index, line ) {
		var obj = {};
		if(line[0] != '#') {		
			var currentline=line.split('\t');

			if (currentline[0] === 'agency_cd') {
				headers=currentline;
			}
			if (currentline[0] !== '5s' && currentline[0] !== 'agency_cd') {
				//console.log(currentline)

				for(var j=0;j<headers.length;j++){
					obj[headers[j]] = currentline[j];
				}

				result.push(obj) 
			}
		}
	});
  
	//return result; //JavaScript object
	return result; //JSON
}

function setBasemap(baseMap) {

	switch (baseMap) {
		case 'Streets': baseMap = 'Streets'; break;
		case 'Satellite': baseMap = 'Imagery'; break;
		case 'Topo': baseMap = 'Topographic'; break;
		case 'Terrain': baseMap = 'Terrain'; break;
		case 'Gray': baseMap = 'Gray'; break;
		case 'NatGeo': baseMap = 'NationalGeographic'; break;
	}

	if (baseMapLayer) 	map.removeLayer(baseMapLayer);
	baseMapLayer = L.esri.basemapLayer(baseMap);
	map.addLayer(baseMapLayer);
	if (basemapLayerLabels) map.removeLayer(basemapLayerLabels);
	if (baseMap === 'Gray' || baseMap === 'Imagery' || baseMap === 'Terrain') {
		basemapLayerLabels = L.esri.basemapLayer(baseMap + 'Labels');
		map.addLayer(basemapLayerLabels);
	}
}

function resetView() {

	//reset geo Filter flag
	geoFilterFlag = false;

	//clear any selection graphics
	sitesLayer.clearLayers();

	//reset view
	map.setView([MapY, MapX], 7);
}