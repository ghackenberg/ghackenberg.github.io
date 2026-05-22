/* Copyright 2016 Georg Hackenberg. All rights reserved. For more information contact mail@georg-hackenberg.de. */

function forEach(callback) {
	for (var index = 0; index < this.length; index++) {
		callback(this[index]);
	}
}

Array.prototype.forEach = forEach;
HTMLCollection.prototype.forEach = forEach;

Node.prototype.addClassName = function(className) {
	if (this.className.indexOf(className) == -1) {
		this.className += ((this.className.length > 0) ? " " : "") + className;
	}
}
Node.prototype.removeClassName = function(className) {
	if (this.className.indexOf(className) != -1) {
		this.className = this.className.replace(className, "");
		this.className = this.className.replace("  ", " ");
		this.className = this.className.replace(/^ /, "");
		this.className = this.className.replace(/ $/, "");
	}
}

var dipToMillimeter = 0.15875;

function computeSize() {		
	var maxWidth = window.innerWidth;
	var maxHeight = window.innerHeight;
		
	if (window.devicePixelRatio) {
		unitWidth = 1;
		unitHeight = 1;
		centimeterWidth = dipToMillimeter / 10 / window.devicePixelRatio * 2.5;
		centimeterHeight = dipToMillimeter / 10 / window.devicePixelRatio * 2.5;
	}
	else {
		var div = document.createElement("div");
		div.style.visibility = "hidden";
		div.style.position = "absolute";
		div.style.overflow = "hidden";
		div.style.top = "0cm";
		div.style.left = "0cm";
		div.style.width = "1cm";
		div.style.height = "1cm";
		
		var body = document.getElementsByTagName("body")[0];
		body.appendChild(div);
		
		unitWidth = div.offsetWidth;
		unitHeight = div.offsetHeight;
		centimeterWidth = 1;
		centimeterHeight = 1;
		
		body.removeChild(div);
	}
	
	console.log(maxWidth / unitWidth * centimeterWidth);
		
	return {
		pixelUnitWidth: unitWidth,
		pixelUnitHeight: unitHeight,
		pixelWindowWidth: maxWidth,
		pixelWindowHeight: maxHeight,
		centimeterUnitWidth: centimeterWidth,
		centimeterUnitHeight: centimeterHeight,
		centimeterWindowWidth: maxWidth / unitWidth * centimeterWidth,
		centimeterWindowHeight: maxHeight / unitHeight * centimeterHeight
	};
}

function convertSize(size, sizeInfo) {
	if (!sizeInfo) {
		sizeInfo = computeSize();
	}
	return {
		pixelWidth: size.pixelWidth,
		pixelHeight: size.pixelHeight,
		centimeterWidth: size.pixelWidth / sizeInfo.pixelUnitWidth * sizeInfo.centimeterUnitWidth,
		centimeterHeight: size.pixelHeight / sizeInfo.pixelUnitHeight * sizeInfo.centimeterUnitHeight
	};
}

function convertWidth(width, sizeInfo) {
	if (!sizeInfo) {
		sizeInfo = computeSize();
	}
	return width / sizeInfo.pixelUnitWidth * sizeInfo.centimeterUnitWidth;
}

function convertHeight(height, sizeInfo) {
	if (!sizeInfo) {
		sizeInfo = computeSize();
	}
	return height / sizeInfo.pixelUnitHeight * sizeInfo.centimeterUnitHeight;
}

function updateStyle(event) {
	var sizeInfo = computeSize();
	
	// console.log(sizeInfo);
	
	// alert(sizeInfo.centimeterWindowWidth);
	// alert(sizeInfo.centimeterWindowHeight);
	
	var body = document.getElementsByTagName("body")[0];
	var header = document.getElementsByTagName("header")[0];
	var main = document.getElementsByTagName("main")[0];
	var footer = document.getElementsByTagName("footer")[0];
	var sections = document.getElementsByTagName("section");
	
	var factor = 0;
	
	if (sizeInfo.centimeterWindowWidth < 15) {
		body.removeClassName("large");
		body.addClassName("small");
		factor = 0.04;
	} else {
		body.removeClassName("small");
		body.addClassName("large");
		factor = 0.02;
	}
	
	var targetWidth = Math.min(sizeInfo.pixelWindowWidth, sizeInfo.pixelWindowHeight * 1.25);
	var borderWidth = (sizeInfo.pixelWindowWidth - targetWidth) / 2;
	var fontSize = targetWidth * factor;
		
	body.style.fontSize = fontSize + "px";
	
	header.style.borderLeftWidth = borderWidth + "px";
	header.style.borderRightWidth = borderWidth + "px";
	
	footer.style.borderLeftWidth = borderWidth + "px";
	footer.style.borderRightWidth = borderWidth + "px";
	
	sections.forEach(function(section) {
		section.style.borderLeftWidth = borderWidth + "px";
		section.style.borderRightWidth = borderWidth + "px";
	});
}

window.onresize = updateStyle;