function LightFieldRenderer() {
	this.image = null;
	this.optics = {};
	this.lenslets = {};
	this.cropwindow = {};
	this.backbone = {};
	this.neurons = [];

	this.loaded = {}; // indexed by variable name
	this.texture = {}; // GL texture cache; indexed by mode name

	this.textdivs = []; // list of textdivs shown on top of canvas

	this.view2d = {
		'mouseSensitivity': 50.0,

		'center_X': 0.0,
		'center_Y': 0.0,

		'mousedrag_X': undefined,
		'mousedrag_Y': undefined
	};
	this.view3d = {
		'mouseSensitivity': 4.0,

		// OpenGL coordinate system (0.0 is the middle)
		'ofs_U': 0.0,
		'ofs_V': 0.0,

		'mousedrag_X': undefined,
		'mousedrag_Y': undefined
	};
};

LightFieldRenderer.prototype.loadimage = function(imagepath) {
	var obj = this;
	if (imagepath == null)
		return;
	console.log("loadimage " + imagepath);

	var lf_baseurl_amazon = "http://nemaload.cachefly.net/";
	var lf_baseurl_local = "/data/";

	var imageurl;
	if (Session.get("useAmazonData")) {
		imageurl = lf_baseurl_amazon + imagepath;
	} else {
		imageurl = lf_baseurl_local + imagepath;
	}

	// This method of asynchronous loading may be problematic if there
	// is still an outstanding request from previous loadimage(); FIXME
	this.loaded = {
		"image": 0,
		"optics": 0,
		"lenslets": 0,
		"cropwindow": 0,
		"backbone": 0,
		"neurons": 0,
	};

	$("#imageLoading" + Session.get("currentFrameIndex")).removeClass("notLoaded").addClass("loading");
	this.image = new Image();
	this.image.crossOrigin = "anonymous";
	this.image.onload = function() {
		obj.loaded.image = 1;
		obj.render_if_ready(1);
		$("#imageLoading" + Session.get("currentFrameIndex")).removeClass("notLoaded").removeClass("loading").addClass("loaded");
	};
	/* Not supported yet :(
	this.image.onloadstart = function() {
		alert("loading started! logging to console");
	};
	this.image.onloadprogress = function(e) 
	{ 
		console.log(e.loaded);
	};
	this.image.onloadend = function () {
		alert("Loading ended!");
	};*/
	this.image.src = imageurl + ".png";

	this.backbone = {};
	var backbonepath = imageurl + "-backbone.json";
	$.getJSON(backbonepath)
		.done(function(data) {
			console.log('got backbone');
			obj.backbone = data;
		})
		.always(function(data) {
			console.log('backbone solved');
			obj.loaded.backbone = 1;
			obj.render_if_ready(1);
		});

	this.neurons = [];
	this.loadneurons();

	this.optics = {
		"maxu": Session.get("op_maxu"),
		"pitch": Session.get("op_pitch"),
		"flen": Session.get("op_flen"),
		"mag": Session.get("op_mag"),
		"abbe": Session.get("op_abbe"),
		"na": Session.get("op_na"),
		"medium": Session.get("op_medium")
	};
	this.loaded.optics = 1;
	this.lenslets = {
		"offset": [Session.get("op_x_offset"), Session.get("op_y_offset")],
		"right": [Session.get("op_right_dx"), Session.get("op_right_dy")],
		"down": [Session.get("op_down_dx"), Session.get("op_down_dy")]
	};
	this.loaded.lenslets = 1;
	if (Session.get("cw_is_set")) {
		this.cropwindow = {
			"ul": [Session.get("cw_x0"), Session.get("cw_y0")],
			"br": [Session.get("cw_x1"), Session.get("cw_y1")],
		};
		this.loaded.cropwindow = 1;
	}
	this.render_if_ready(1);
}

LightFieldRenderer.prototype.loadneurons = function() {
	var obj = this;
	var baseName = Images.findOne(Session.get("currentImageId")).baseName;
	var frameNo = Session.get("currentFrameIndex");
	var poseInfo = Session.get("currentPoseZoom") + ',' + Session.get("currentPoseShift") + ',' + Session.get("currentPoseAngle");
	var neuronspath = baseName + "/neuron-positions/" + frameNo + "/" + poseInfo;
	var neuronsurl = computationUrl + neuronspath;
	$.getJSON(neuronsurl)
		.done(function(data) {
			console.log('got backbone');
			obj.neurons = data.neurons;
		})
		.always(function(data) {
			console.log('backbone solved');
			obj.loaded.neurons = 1;
			obj.render_if_ready(1);
		});
}

LightFieldRenderer.prototype.render_if_ready = function(is_new_image) {
	console.log("render_if_ready " + this.loaded.image + " " + this.loaded.backbone + " " + this.loaded.optics + " " + this.loaded.lenslets + " " + this.loaded.neurons);
	if (!this.loaded.image || !this.loaded.backbone || !this.loaded.optics || !this.loaded.lenslets || !this.loaded.neurons)
		return;
	this.render(is_new_image);
}

LightFieldRenderer.prototype.setUV = function(U, V) {
	var newofs_U = U;
	var newofs_V = V;

	var rel_U = newofs_U / this.lenslets.right[0];
	var rel_V = newofs_V / this.lenslets.down[1];
	var UV_dist = rel_U * rel_U + rel_V * rel_V;
	var max_slope = this.maxNormalizedSlope();
	if (UV_dist > max_slope * max_slope) {
		console.log(UV_dist + " > " + max_slope * max_slope)
		return;
	}

	this.view3d.ofs_U = newofs_U;
	this.view3d.ofs_V = newofs_V;
	this.render(0);
	this.updateUV_display();
}

LightFieldRenderer.prototype.updateUV = function(delta_U, delta_V) {
	this.setUV(this.view3d.ofs_U + delta_U, this.view3d.ofs_V + delta_V);
}

LightFieldRenderer.prototype.updateUV_display = function() {
	$('#U_current').html(parseFloat(this.view3d.ofs_U).toFixed(2));
	$('#V_current').html(parseFloat(this.view3d.ofs_V).toFixed(2));

	var canvas = document.getElementById("canvas-uvpos");
	var cuvpos = canvas.getContext("2d");
	cuvpos.clearRect(0, 0, canvas.width, canvas.height);

	var cradius = (canvas.width - 2) / 2;
	cuvpos.beginPath();
	cuvpos.arc(cradius + 1, cradius + 1, cradius, 0, 2 * Math.PI);
	cuvpos.stroke();

	var pos_x, pos_y;
	if (this.loaded.optics && this.loaded.lenslets) {
		console.log(this.lenslets);
		var rel_U = this.view3d.ofs_U / this.lenslets.right[0];
		var rel_V = this.view3d.ofs_V / this.lenslets.down[1];
		var max_slope = this.maxNormalizedSlope();
		pos_x = canvas.width / 2 + cradius * rel_U / max_slope;
		pos_y = canvas.height / 2 - cradius * rel_V / max_slope;
	} else {
		/* UV coordinates make no sense yet, just draw a point in the middle. */
		pos_x = canvas.width / 2;
		pos_y = canvas.height / 2;
	}
	cuvpos.beginPath();
	cuvpos.arc(pos_x, pos_y, 2, 0, Math.PI * 2, true);
	cuvpos.closePath();
	cuvpos.fill();
}

LightFieldRenderer.prototype.updateCenter = function(delta_X, delta_Y) {
	var newcenter_X = this.view2d.center_X + delta_X;
	var newcenter_Y = this.view2d.center_Y + delta_Y;

	if (newcenter_X >= 1. || newcenter_X <= -1. || newcenter_Y >= 1. || newcenter_Y <= -1.) {
		console.log("out of bounds ", newcenter_X, newcenter_Y);
		return;
	}

	this.view2d.center_X = newcenter_X;
	this.view2d.center_Y = newcenter_Y;
	this.render(0);
}

LightFieldRenderer.prototype.mousedrag_set = function(new_X, new_Y) {
	if (mode == "image") {
		this.view2d.mousedrag_X = new_X;
		this.view2d.mousedrag_Y = new_Y;
	} else {
		this.view3d.mousedrag_X = new_X;
		this.view3d.mousedrag_Y = new_Y;
	}
}
LightFieldRenderer.prototype.mousedrag = function(new_X, new_Y) {
	if (mode == "image") {
		if (this.view2d.mousedrag_X) {
			var canvas = document.getElementById("canvas-image");
			this.updateCenter(-(new_X - this.view2d.mousedrag_X) / canvas.width,
			                  (new_Y - this.view2d.mousedrag_Y) / canvas.height);
		}
		this.view2d.mousedrag_X = new_X;
		this.view2d.mousedrag_Y = new_Y;
	} else {
		if (this.view3d.mousedrag_X) {
			this.updateUV((new_X - this.view3d.mousedrag_X) / this.view3d.mouseSensitivity,
				      -(new_Y - this.view3d.mousedrag_Y) / this.view3d.mouseSensitivity);
		}
		this.view3d.mousedrag_X = new_X;
		this.view3d.mousedrag_Y = new_Y;
	}
}

LightFieldRenderer.prototype.maxNormalizedSlope = function() {
	/* Return the maximum slope afforded by the optical system */

	if (Session.get("op_maxu") > 0)
		this.optics.maxu = Session.get("op_maxu"); // update
	if (this.optics.maxu > 0)
		return this.optics.maxu; // override

	// ???
	var image_na = this.optics.na / this.optics.mag;
	if (image_na >= 1.0) return 0.0;
	var na_slope = image_na / Math.sqrt(1.0 - image_na * image_na);

	// slope of looking at a lens neighboring with central lens
	var ulens_slope = this.optics.pitch / this.optics.flen;

	return na_slope / ulens_slope;
}

LightFieldRenderer.prototype.lenslets_offset2corner = function(corner) {
	/* Walk from the lenslets.offset point to the point of the grid
	 * nearest to the top left corner. */

	var lenslets = this.lenslets;
	var changed;
	do {
		changed = false;
		if (corner[1] > corner[0] && corner[0] > lenslets.down[0] && corner[1] > lenslets.down[1]) {
			corner[0] -= lenslets.down[0];
			corner[1] -= lenslets.down[1];
			changed = true;
		}
		if (corner[0] > lenslets.right[0] && corner[1] > lenslets.right[1]) {
			corner[0] -= lenslets.right[0];
			corner[1] -= lenslets.right[1];
			changed = true;
		}
		if (corner[1] > corner[0] && corner[0] > lenslets.down[0] && corner[1] > lenslets.down[1]) {
			corner[0] -= lenslets.down[0];
			corner[1] -= lenslets.down[1];
			changed = true;
		}
	} while (changed);
	/* FIXME: Note that we might get stuck at a point where we e.g. still have
	 * some room to go many steps up at the cost of going one step right. */

	console.log("lenslets " + JSON.stringify(lenslets) + " -> corner offset " + corner);

	return corner;
}

LightFieldRenderer.prototype.grid_params = function() {
	var gridCorner = this.lenslets.offset.slice();
	var cropImageSize;

	if (this.loaded.cropwindow) {
		// adjust for cropping

		// ul and br are rotated by 90 degrees here
		var ul = [this.cropwindow.br[0], this.cropwindow.ul[0]];
		var br = [this.cropwindow.br[1], this.cropwindow.ul[1]];
		console.log(ul, br);

		cropImageSize = {
			"width": br[0] - ul[0] + 1,
			"height": br[1] - ul[1] + 1
		};
		// by temporarily subtracting ul, we make that the point of origin for the grid
		gridCorner[0] -= ul[0];
		gridCorner[1] -= ul[1];
		gridCorner = this.lenslets_offset2corner(gridCorner);
		gridCorner[0] += ul[0];
		gridCorner[1] += ul[1];

	} else {
		// no cropping, be straightforward
		cropImageSize = {
			"width": this.image.width,
			"height": this.image.height
		};
		gridCorner = this.lenslets_offset2corner(gridCorner);
	}

	var gridSize = {
		"width": Math.floor(cropImageSize.width / this.lenslets.right[0]),
		"height": Math.floor(cropImageSize.height / this.lenslets.down[1])
	};

	return {
		"corner": gridCorner,
		"size": gridSize
	};
}


LightFieldRenderer.prototype.render = function(is_new_image) {
	//grabs the canvas element
	var canvas = document.getElementById("canvas-" + mode);
	canvas.height = canvas.width * this.image.height / this.image.width;

	// reset textdivs
	var d;
	while (d = this.textdivs.pop()) {
		d.remove();
	}

	//gets the WebGL context
	var gl = getWebGLContext(canvas);
	//checks if system is WebGL compatible
	if (!gl) {
		alert("WebGL not supported in this browser, sorry");
		return;
	}

	gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
	gl.enable(gl.BLEND);
	gl.disable(gl.DEPTH_TEST);

	if (mode == "image") {
		this.render_image(canvas, gl);
	} else {
		this.render_lightfield_pinhole(canvas, gl);
	}

	if (1) { // is_new_image) { TODO: <canvas> must persist re-renders for this to work properly
		if (this.texture[mode]) {
			gl.deleteTexture(this.texture[mode]);
		}
		this.texture[mode] = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, this.texture[mode]);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.image);
	} else {
		gl.bindTexture(gl.TEXTURE_2D, this.texture[mode]);
	}
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.drawArrays(gl.TRIANGLES, 0, 6);

	//if (mode == "image" && $('#grid').prop('checked'))
	if (mode == "image" && Session.get('showGrid')) {
		this.render_grid(canvas, gl);
		if (this.loaded.cropwindow)
			this.render_cropwindow(canvas, gl);
		this.render_lens_circle(canvas, gl);
	}

	console.log(this.backbone);
	if (mode == "3d" && this.backbone.bbpoints) {
		this.render_backbone(canvas, gl);
	}

	if (mode == "3d" && $('#neurons').prop('checked') && this.neurons) {
		this.render_neurons(canvas, gl);
	}
}

LightFieldRenderer.prototype.render_image = function(canvas, gl) {
	// compile shaders
	vertexShader = createShaderFromScriptElement(gl, "image-vertex-shader");
	fragmentShader = createShaderFromScriptElement(gl, "lf-image-fragment-shader");
	program = createProgram(gl, [vertexShader, fragmentShader]);
	gl.useProgram(program);

	// set(up) parameters
	var canvSizeLocation = gl.getUniformLocation(program, "u_canvSize");
	gl.uniform2f(canvSizeLocation, canvas.width, canvas.height);
	var gammaGainLocation = gl.getUniformLocation(program, "u_gammaGain");
	gl.uniform2f(gammaGainLocation, parseFloat(Session.get("currentImageGamma")), Math.pow(10, parseFloat(Session.get("currentImageGain"))));
	var zoomLocation = gl.getUniformLocation(program, "u_zoom");
	gl.uniform3f(zoomLocation, this.view2d.center_X, this.view2d.center_Y,
			Math.pow(10, parseFloat(Session.get("currentImageZoom"))));

	var texCoordBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
	setRectangle(gl, 0.0, 0.0, 1.0, 1.0);
	var texCoordLocation = gl.getAttribLocation(program, "a_texCoord");
	gl.enableVertexAttribArray(texCoordLocation);
	gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

	var canvCoordBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, canvCoordBuffer);
	setRectangle(gl, 0, 0, canvas.width, canvas.height);
	var canvCoordLocation = gl.getAttribLocation(program, "a_canvCoord");
	gl.enableVertexAttribArray(canvCoordLocation);
	gl.vertexAttribPointer(canvCoordLocation, 2, gl.FLOAT, false, 0, 0);
}

LightFieldRenderer.prototype.render_lightfield_pinhole = function(canvas, gl) {
	// compile shaders
	vertexShader = createShaderFromScriptElement(gl, "image-vertex-shader");
	fragmentShader = createShaderFromScriptElement(gl, "lf-pinhole-fragment-shader");
	program = createProgram(gl, [vertexShader, fragmentShader]);
	gl.useProgram(program);

	var grid = this.grid_params();

	// set(up) parameters
	var canvSizeLocation = gl.getUniformLocation(program, "u_canvSize");
	gl.uniform2f(canvSizeLocation, canvas.width, canvas.height);
	var gammaGainLocation = gl.getUniformLocation(program, "u_gammaGain");
	gl.uniform2f(gammaGainLocation, parseFloat(Session.get("currentImageGamma")), Math.pow(10, parseFloat(Session.get("currentImageGain"))));
	var zoomLocation = gl.getUniformLocation(program, "u_zoom");
	gl.uniform3f(zoomLocation, 0., 0., 1.);

	var gridSizeLocation = gl.getUniformLocation(program, "u_gridSize");
	gl.uniform2f(gridSizeLocation, grid.size.width, grid.size.height);
	var rectOffsetLocation = gl.getUniformLocation(program, "u_rectOffset");
	gl.uniform2f(rectOffsetLocation, grid.corner[0] / this.image.width, grid.corner[1] / this.image.height);
	var rectLinearLocation = gl.getUniformLocation(program, "u_rectLinear");
	gl.uniformMatrix2fv(rectLinearLocation, false,
			[this.lenslets.right[0] / this.image.width,
			 this.lenslets.right[1] / this.image.height,
			 this.lenslets.down[0] / this.image.width,
			 this.lenslets.down[1] / this.image.height]);
	var UVCoordLocation = gl.getUniformLocation(program, "u_UVCoord");
	gl.uniform2f(UVCoordLocation, this.view3d.ofs_U / this.lenslets.right[0], this.view3d.ofs_V / this.lenslets.down[1]);

	var texCoordBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
	setRectangle(gl, 0.0, 0.0, 1.0, 1.0);
	var texCoordLocation = gl.getAttribLocation(program, "a_texCoord");
	gl.enableVertexAttribArray(texCoordLocation);
	gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

	var canvCoordBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, canvCoordBuffer);
	setRectangle(gl, 0, 0, canvas.width, canvas.height);
	var canvCoordLocation = gl.getAttribLocation(program, "a_canvCoord");
	gl.enableVertexAttribArray(canvCoordLocation);
	gl.vertexAttribPointer(canvCoordLocation, 2, gl.FLOAT, false, 0, 0);
}

LightFieldRenderer.prototype.render_grid = function(canvas, gl) {
	var vertexShader = createShaderFromScriptElement(gl, "lf-grid-vertex-shader");
	var fragmentShader = createShaderFromScriptElement(gl, "lf-grid-fragment-shader");
	var program = createProgram(gl, [vertexShader, fragmentShader]);
	gl.useProgram(program);

	var grid = this.grid_params();
	console.log("grid ", grid);
	if (Session.get('showGridUV')) {
		grid.corner[0] += this.view3d.ofs_U;
		grid.corner[1] += this.view3d.ofs_V;
	}

	var lineList = new Array;
	for (var x = 0; x <= grid.size.width; x++) {
		lineList.push(grid.corner[0] + x * this.lenslets.right[0]);
		lineList.push(grid.corner[1] + x * this.lenslets.right[1]);
		lineList.push(grid.corner[0] + x * this.lenslets.right[0] + grid.size.height * this.lenslets.down[0]);
		lineList.push(grid.corner[1] + x * this.lenslets.right[1] + grid.size.height * this.lenslets.down[1]);
	}
	for (var y = 0; y <= grid.size.height; y++) {
		lineList.push(grid.corner[0] + y * this.lenslets.down[0]);
		lineList.push(grid.corner[1] + y * this.lenslets.down[1]);
		lineList.push(grid.corner[0] + y * this.lenslets.down[0] + grid.size.width * this.lenslets.right[0]);
		lineList.push(grid.corner[1] + y * this.lenslets.down[1] + grid.size.width * this.lenslets.right[1]);
	}

	var gridLinesBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, gridLinesBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lineList), gl.STATIC_DRAW);
	var canvCoordLocation = gl.getAttribLocation(program, "a_canvCoord");
	gl.enableVertexAttribArray(canvCoordLocation);
	gl.vertexAttribPointer(canvCoordLocation, 2, gl.FLOAT, false, 0, 0);

	var imageSizeLocation = gl.getUniformLocation(program, "u_imageSize");
	gl.uniform2f(imageSizeLocation, this.image.width, this.image.height);
	var zoomLocation = gl.getUniformLocation(program, "u_zoom");
	gl.uniform3f(zoomLocation, this.view2d.center_X, this.view2d.center_Y,
			Math.pow(10, parseFloat(Session.get("currentImageZoom"))));

	gl.drawArrays(gl.LINES, 0, lineList.length / 2);
}

LightFieldRenderer.prototype.render_cropwindow = function(canvas, gl) {
	var vertexShader = createShaderFromScriptElement(gl, "lf-grid-vertex-shader");
	var fragmentShader = createShaderFromScriptElement(gl, "lf-cropwindow-fragment-shader");
	var program = createProgram(gl, [vertexShader, fragmentShader]);
	gl.useProgram(program);

	var ul = [this.cropwindow.br[0], this.cropwindow.ul[0]];
	var br = [this.cropwindow.br[1], this.cropwindow.ul[1]];

	var lineList = new Array;
	lineList.push(ul[0]); lineList.push(ul[1]);
	lineList.push(br[0]); lineList.push(ul[1]);
	lineList.push(br[0]); lineList.push(br[1]);
	lineList.push(ul[0]); lineList.push(br[1]);

	var gridLinesBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, gridLinesBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lineList), gl.STATIC_DRAW);
	var canvCoordLocation = gl.getAttribLocation(program, "a_canvCoord");
	gl.enableVertexAttribArray(canvCoordLocation);
	gl.vertexAttribPointer(canvCoordLocation, 2, gl.FLOAT, false, 0, 0);

	var imageSizeLocation = gl.getUniformLocation(program, "u_imageSize");
	gl.uniform2f(imageSizeLocation, this.image.width, this.image.height);
	var zoomLocation = gl.getUniformLocation(program, "u_zoom");
	gl.uniform3f(zoomLocation, this.view2d.center_X, this.view2d.center_Y,
			Math.pow(10, parseFloat(Session.get("currentImageZoom"))));

	gl.drawArrays(gl.LINE_LOOP, 0, lineList.length / 2);
}

LightFieldRenderer.prototype.render_lens_circle = function(canvas, gl) {
	var vertexShader = createShaderFromScriptElement(gl, "lf-grid-vertex-shader");
	var fragmentShader = createShaderFromScriptElement(gl, "lf-circle-fragment-shader");
	var program = createProgram(gl, [vertexShader, fragmentShader]);
	gl.useProgram(program);

	var center = this.lenslets.offset;
	var radius_x = this.maxNormalizedSlope() * this.lenslets.right[0];
	var radius_y = this.maxNormalizedSlope() * this.lenslets.down[1];
	console.log('lens circle center ', center, ' radius ', radius_x, radius_y);
	var segments = 64.;
	var lineList = new Array;
	for (var i = 0; i < segments; i++) {
		lineList.push(center[0] + Math.cos(2.0*Math.PI * i/segments) * radius_x,
		              center[1] + Math.sin(2.0*Math.PI * i/segments) * radius_y);
	}

	var circleLinesBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, circleLinesBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lineList), gl.STATIC_DRAW);
	var canvCoordLocation = gl.getAttribLocation(program, "a_canvCoord");
	gl.enableVertexAttribArray(canvCoordLocation);
	gl.vertexAttribPointer(canvCoordLocation, 2, gl.FLOAT, false, 0, 0);

	var imageSizeLocation = gl.getUniformLocation(program, "u_imageSize");
	gl.uniform2f(imageSizeLocation, this.image.width, this.image.height);
	var zoomLocation = gl.getUniformLocation(program, "u_zoom");
	gl.uniform3f(zoomLocation, this.view2d.center_X, this.view2d.center_Y,
			Math.pow(10, parseFloat(Session.get("currentImageZoom"))));

	gl.drawArrays(gl.LINE_LOOP, 0, lineList.length / 2);
}

LightFieldRenderer.prototype.render_backbone = function(canvas, gl) {
	var vertexShader = createShaderFromScriptElement(gl, "lf-grid-vertex-shader");
	var fragmentShader = createShaderFromScriptElement(gl, "lf-backbone-fragment-shader");
	var program = createProgram(gl, [vertexShader, fragmentShader]);
	gl.useProgram(program);

	var grid = this.grid_params();

	var lineList = new Array;
	for (var i = 0; i < this.backbone.bbpoints.length; i++) {
		var point = this.backbone.bbpoints[i];
		if (i > 0)
			lineList.push(point[0], grid.size.height-1 - point[1]);
		if (i < this.backbone.bbpoints.length - 1)
			lineList.push(point[0], grid.size.height-1 - point[1]);
	}

	var bbLinesBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, bbLinesBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lineList), gl.STATIC_DRAW);
	var canvCoordLocation = gl.getAttribLocation(program, "a_canvCoord");
	gl.enableVertexAttribArray(canvCoordLocation);
	gl.vertexAttribPointer(canvCoordLocation, 2, gl.FLOAT, false, 0, 0);

	var imageSizeLocation = gl.getUniformLocation(program, "u_imageSize");
	gl.uniform2f(imageSizeLocation, grid.size.width, grid.size.height);
	var zoomLocation = gl.getUniformLocation(program, "u_zoom");
	gl.uniform3f(zoomLocation, 0.0, 0.0, 1.0);

	gl.drawArrays(gl.LINES, 0, lineList.length / 2);
}

LightFieldRenderer.prototype.render_neuron = function(canvas, name, pos) {
	var textdiv = document.createElement('div');
	textdiv.appendChild(document.createTextNode(name));
	textdiv.className = 'neuronlabel';
	textdiv.style.left = (canvas.offsetLeft + pos[0]) + 'px';
	textdiv.style.top = (canvas.offsetTop + pos[1]) + 'px';
	document.getElementById("canvas-3d-container").appendChild(textdiv);
	this.textdivs.push(textdiv);
}

LightFieldRenderer.prototype.render_neurons = function(canvas, gl) {
	var grid = this.grid_params();

	for (var i = 0; i < this.neurons.length; i++) {
		// rescale pos
		pos = this.neurons[i].pos.slice(0);
		pos[0] = pos[0] / grid.size.width * canvas.width;
		pos[1] = pos[1] / grid.size.height * canvas.height;

		this.render_neuron(canvas, this.neurons[i].name, pos);
	}
}
