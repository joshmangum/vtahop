/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */


var app = {
    // Application Constructor
    initialize: function() {
        this.bindEvents();
    },

    // Bind Event Listeners
    //
    // Bind any events that are required on startup. Common events are:
    // 'load', 'deviceready', 'offline', and 'online'.
    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
    },
    // deviceready Event Handler
    //
    // The scope of 'this' is the event. In order to call the 'receivedEvent'
    // function, we must explicitly call 'app.receivedEvent(...);'
    onDeviceReady: function() {
        app.receivedEvent('deviceready');
        app.go();
    },
    // Update DOM on a Received Event
    receivedEvent: function(id) {
    },
    geoSuccess : function(position) {
        if (this.name == null) {
            this.name = "null";
        }
        var result = this.name + ' Lat/L: '          + position.coords.latitude.toFixed(5)          + '/' +
                          + position.coords.longitude.toFixed(5)         + ' ' +
                //'Altitude: '          + position.coords.altitude          + '\n' +
                //'Accuracy: '          + position.coords.accuracy          + '\n' +
                //'Altitude Accuracy: ' + position.coords.altitudeAccuracy  + '\n' +
                //'Heading: '           + position.coords.heading           + '\n' +
                //'Speed: '             + position.coords.speed             + '\n' +
            'ts: '         + app.shortTimestampStr(position.timestamp)       + '';
        out(result);

    },
    namedGeoSuccessFunc : function(aName) {
        return app.geoSuccess.bind({name:aName});
    },
    reportGeoError : function(error) {
        out("geo error: " + error.message);
    },

    latLon: null,
    fullPosition: null,
    setLatLon: function(latLon, position) {
        app.latLon = latLon;
        app.fullPosition = position;
    },
    getFullPosition: function() {
        return app.fullPosition;
    },
    getLatLon: function() {
        if (app.latLon != null) {
            if( parseFloat(app.latLon[0],10) > 37.58065) {
                // near 22 (live predictions)
                app.latLon = ["37.352527", "-121.959446"];
            }
        }
        return app.latLon;
    },
    getPositionProm: function() {
        var deferred = $.Deferred();
        navigator.geolocation.getCurrentPosition(deferred.resolve, deferred.reject);
        return deferred.promise();
    },
    go : function () {
        app.monitorBeacons();
        app.showStatus("Getting Location...");

        var geoProm = app.getPositionProm();
        geoProm.done(function(position) {
            var latLon = [position.coords.latitude.toFixed(5),position.coords.longitude.toFixed(5)];
            app.setLatLon (latLon, position);
            latLon = app.getLatLon();

            var predProm = $.getJSON("http://api.transitime.org/api/v1/key/b9a06e4b/command/predictionsByLoc?lat=" +
                latLon[0] + "&lon="+latLon[1]+"&maxDistance=1500&numPreds=4");
            //var jsonProm = $.getJSON("predictionsByLocEx3.json");

            predProm.done(function(data) {
                console.log("predProm success", data);
                app.showPredictions( data);
            });

            predProm.fail(function(error) {
                console.log("predProm fail", error);
                app.showStatus("No VTA stops within a mile of current location.");
            });

        });
        geoProm.fail(function(error) {
            out("geoProm fail " + JSON.stringify(error));
            console.log("geoProm fail ",error);
            app.showStatus("Unable to find current location.");
        });
    },

    makeRactiveData: function(data) {
        var predictions = data.agencies[1].predictions;

        var routeRows = [];

        for (var i=0; i < predictions.length; i++) {
            var routeRow = {};
            routeRow.routeName = predictions[i].routeId;
            routeRow.stopId = predictions[i].stopId;
            routeRow.routeDir = predictions[i].dest[0].dir;

            routeRow.routeDirName = predictions[i].dest[0].headsign;
            routeRow.routeDirStopName = predictions[i].stopName;

            var distanceIntegerFeet = parseInt(predictions[i].distanceToStop * 3.28084,10);
            var distanceMiles = predictions[i].distanceToStop * 0.000621371;
            var distanceMilesRounded = distanceMiles.toFixed(1);
            var distStr = distanceIntegerFeet < 1000 ? distanceIntegerFeet + " feet" : distanceMilesRounded +" miles";

            routeRow.stopDist = distStr;
            var vehPreds = predictions[i].dest[0].pred;

            if (vehPreds.length == 0) {
                continue;
            }
            routeRow.times = [];
            for (var j = 0; j < vehPreds.length && j < 4; j++ ){
                var vehPred = vehPreds[j];
                var lPrediction =!( vehPred.scheduleBased != null && vehPred.scheduleBased);
                routeRow.times.push({minutes: "" + vehPred.min, livePrediction: lPrediction });
            }

            routeRows.push(routeRow);
        }
        return routeRows;

    },
    showStatus: function (status) {
        var ractiveStatus = new Ractive({
            el: '#status',
            template: '#status-tmpl',
            data: {statusStr: status}
        });
    },
    openMap: function(rEvent) {
        var routeName = $(rEvent.node).find('.route-name');
        var routeId = routeName.text();
        var stopId = routeName.attr("data-stop-num");
        var stopDir = routeName.attr("data-stop-dir");

        var url = "http://api.transitime.org/web/map/smartphoneMap.html?a=vta-bus&r=" + routeId + "&d=" + stopDir +"&s=" +
            stopId;
        console.log(url);

        var target = "_blank";
        var options = "location=no,"+
            "transitionstyle=fliphorizontal" +
            ",toolbarposition=top";
        console.log("clicked open-map", url);
        var ref = cordova.InAppBrowser.open(url, target, options);
    },
    showPredictionsRactive: function( data) {
        app.showStatus("");
        var routeRows = app.makeRactiveData(data);

        var ractive = new Ractive({
            el: '#rcontent',
            template: '#routes-tmpl',
            preserveWhitespace: true,
            data: {routeRows: routeRows}
        });
        ractive.on("open-map", app.openMap);

        var reloadTime = 40000;
        setTimeout(function() {
            var latLon = app.getLatLon();
            var url = "http://api.transitime.org/api/v1/key/b9a06e4b/command/predictionsByLoc?lat=" +
                        latLon[0] + "&lon="+latLon[1]+"&maxDistance=1500&numPreds=4";
            console.log("updating with ", url);
            var prom = $.getJSON(url);
            prom.done(function(data2) {
                console.log("getJson success 2");
                console.log(data2);
                if (data2 != null) {
                    routeRows = app.makeRactiveData(data2);
                    console.log("update", routeRows);
                    ractive.merge("routeRows", routeRows, true);
                }
            });

            prom.fail(function(data) {
                console.log("get predictionsByLoc json fail", data);
            });
            var geoProm = app.getPositionProm();
            geoProm.done(function(position) {
                var latLon = [position.coords.latitude.toFixed(5), position.coords.longitude.toFixed(5)];
                app.setLatLon(latLon, position);
            });

            setTimeout(arguments.callee, reloadTime);

        }, reloadTime);
    },
    showPredictions: function( data) {
        app.showPredictionsRactive(data);
    },
    gpsRepeatId: null,
    startSendingGPS: function() {
        var interval = 20000;
        console.log("startSendingGPS");

        if (app.gpsRepeatId != null) {
            return;
        }
        app.gpsRepeatId = setTimeout(function aFunc() {
            // http://api.transitime.org/api/v1/key/b9a06e4b/agency/vta-bus/command/pushAvl?v=veha&t=2929&lat=-37&lon=-122
            var position = app.getFullPosition();
            console.log("startSendingGPS2");
            if (position != null) {
                var url = "http://api.transitime.org/api/v1/key/b9a06e4b/agency/vta-bus/command/pushAvl?v=veha&t="+
                    position.timestamp.getTime()+"&lat=" + position.coords.latitude.toFixed(5)+
                    "&lon="+position.coords.longitude.toFixed(5);
                console.log("startSendingGPS3", url);
                var sendPositionProm =
                    $.getJSON(url);
                sendPositionProm.done(function() {
                    console.log("sent gps", url);
                });
                sendPositionProm.fail(function(error) {
                    console.log("failed gps send", error);
                });
            }
            app.gpsRepeatId = setTimeout(aFunc, interval);
        }, interval);
    },
    endSendingGPS: function() {
        if(app.gpsRepeatId != null) {
            window.clearTimeout(app.gpsRepeatId);
            app.gpsRepeatId = null;
        }
    },
    monitorBeacons: function() {
        var delegate = new cordova.plugins.locationManager.Delegate();
        var pluginShort = function (pluginResult) {
            return JSON.stringify(pluginResult);
        };
        delegate.didDetermineStateForRegion = function (pluginResult) {
            out('dsfr ' +app.shortNowTimestampStr()+" "+ JSON.stringify(pluginResult));
        };
        out("setting beacon delegate2");

        delegate.didStartMonitoringForRegion = function (pluginResult) {
            out('smfr ' +app.shortNowTimestampStr()+" "+ pluginShort(pluginResult));
        };

        delegate.didRangeBeaconsInRegion = function (pluginResult) {
            out('rbir ' +app.shortNowTimestampStr()+" "+ pluginShort(pluginResult));
        };
        delegate.didEnterRegion = function (pluginResult) {
            out('enterR ' +app.shortNowTimestampStr()+" "+ pluginShort(pluginResult));

            app.startSendingGPS();
            //app.watchId = navigator.geolocation.watchPosition(app.namedGeoSuccessFunc("enterR wP:"), app.reportGeoError, { maximumAge: 5000,
            //               timeout: 5000, enableHighAccuracy: true });
        };
        delegate.didExitRegion = function (pluginResult) {
            out('exitR ' +app.shortNowTimestampStr()+" "+ pluginShort(pluginResult));
            app.endSendingGPS();
        };

        cordova.plugins.locationManager.setDelegate(delegate);

        // required in iOS 8+
        cordova.plugins.locationManager.requestWhenInUseAuthorization();
        // or cordova.plugins.locationManager.requestAlwaysAuthorization()

        var beacon1 =     ["kon 1", 'f7826da6-4fa2-4e98-8024-bc5b71e0893e', 100, 1];
        var beacon2 =     ["feFl", 'f7826da6-4fa2-4e98-8024-bc5b71e0893e', 100, 2];
        var beacon3 =     ["E1Go", 'f7826da6-4fa2-4e98-8024-bc5b71e0893e', 100, 3];
        var beaconIpad = ["j ipad", 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0', 1, 1];

        //var beaconRegion = new cordova.plugins.locationManager.BeaconRegion(identifier, uuid, major, minor);
        var beaconRegion = new cordova.plugins.locationManager.BeaconRegion(beacon2[0], beacon2[1],
            beacon2[2], beacon2[3]);

        cordova.plugins.locationManager.startMonitoringForRegion(beaconRegion)
            .fail(out)
            .done(out);

        //out("calling startRangingBeaconsInRegion(beaconRegion)");
        //cordova.plugins.locationManager.startRangingBeaconsInRegion(beaconRegion)
        //    .fail(console.error)
        //    .done();

    },
    shortNowTimestampStr: function() {
        var now = new Date();
        return app.shortTimestampStr(now);
    },
    shortTimestampStr: function (aDate) {
        return aDate.getHours() + ":" +aDate.getMinutes() +":"+aDate.getSeconds()
    }
};

app.initialize();

// Occasionally useful when debugging untethered device (espcially with invisible
// background geolocation and beacons)
var out = function(message, another) {
    if (another == null) another = "";
    $(".out").append(message + " " +another +"<BR>");
    console.log(message, another);
};