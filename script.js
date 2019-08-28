var cableApp = angular.module('cableApp',[]);

var formatForce = function(N) {
	let force = Math.abs(N);
	if(force < 0.001) {
		return Math.round(N * 1000000) + "uN";
	} else if(force < 1) {
		return Math.round(N * 1000) + "mN";
	} else if(force < 1000) {
		return Math.round(N) + " N";
	} else if(force < 1000000) {
		return Math.round(N / 1000) + "kN";
	}
};

var formatEnergy = function(J) {
	let energy = Math.abs(J);
	if(energy < 0.001) {
		return Math.round(J * 1000000) + "uJ";
	} else if(energy < 1) {
		return Math.round(J * 1000) + "mJ";
	} else if(energy < 1000) {
		return Math.round(J) + " J";
	} else if(energy < 1000000) {
		return Math.round(J / 1000) + "kJ";
	}
};

let getForce = function(strain, E, rad) {
	return strain * E * (Math.PI * rad * rad);
};

cableApp.controller('CableController', ['$scope', function($scope){
	$scope.time = 0;
	$scope.timeFormatted = 0;
	$scope.maxForce = 0.0;
	
	$scope.strainMode = "Elastoplastic";
	$scope.deltaL = 0.0;
	$scope.strain = 0.0; $scope.strainFormatted = 0;
	$scope.particleMass = 1.0;
	$scope.particleX = -0.9;
	$scope.particleY = -0;
	$scope.forceX = 0.0; $scope.forceXFormatted = 0;
	$scope.forceY = 0.0; $scope.forceYFormatted = 0;
	$scope.velocityX = 0.0;
	$scope.velocityY = 0.0;
	$scope.cableRadius = 0.00005;
	$scope.cableLength = 1;
	$scope.yieldStrength = 215000000;
	$scope.ultimateStrength = 505000000;
	$scope.E = 193000000000;
	$scope.x0 = -0.9;
	$scope.y0 = 0;
	
	$scope.potentialEnergyFormatted = 0;
	$scope.kinecticEnergyFormatted = 0;
	$scope.elasticEnergyFormatted = 0;
	
	$scope.drawForce = true;
	$scope.drawPath = true;
	$scope.drawPeakForce = true;
	
	$scope.path = [];
	
	$scope.drawSim = function() {
		let canvasEle = document.getElementById('sim');
		if(canvasEle === null) return;
		
		let ctx = canvasEle.getContext('2d');

		let scale = canvasEle.height / 2;
		ctx.resetTransform();
		ctx.clearRect(0, 0, canvasEle.width, canvasEle.height);
		ctx.translate(canvasEle.width / 2, 10);
		ctx.scale(700, 700);
		ctx.lineWidth = 0.002;

		let forceScale = 0.01;

		//draw grid
		ctx.strokeStyle = "#ccc";
		for (let x = -10; x < 10; x++) {
			ctx.beginPath();
			ctx.moveTo(x, -10);
			ctx.lineTo(x, 10);
			ctx.stroke();
		}
		for (let y = -10; y < 10; y++) {
			ctx.beginPath();
			ctx.moveTo(-10, y);
			ctx.lineTo(10, y);
			ctx.stroke();
		}
		
		ctx.font = "0.02px Consolas";
		for (let x = -10; x < 10; x++) {
			for (let y = -10; y < 10; y++) {

				ctx.fillText("x:" + x + "m", x + 0.001, y + 0.001);
				ctx.fillText("y:" + y + "m", x + 0.001, y + 0.019);
			}
		}

		for (let i = 1; i < $scope.path.length - 1; i++) {
			if ($scope.drawPath) {
				ctx.strokeStyle = "#aaa";
				ctx.beginPath();
				ctx.moveTo($scope.path[i].x, -$scope.path[i].y);
				ctx.lineTo($scope.path[i + 1].x, -$scope.path[i + 1].y);
				ctx.stroke();
			}

			if ($scope.path[i - 1].f != 0 || $scope.path[i].f != 0 || $scope.path[i + 1].f != 0) {
				if ($scope.drawForce) {
					ctx.strokeStyle = "#faa";
					ctx.beginPath();
					ctx.moveTo($scope.path[i].x +     $scope.path[i].fx * forceScale,     -$scope.path[i].y -     $scope.path[i].fy * forceScale);
					ctx.lineTo($scope.path[i + 1].x + $scope.path[i + 1].fx * forceScale, -$scope.path[i + 1].y - $scope.path[i + 1].fy * forceScale);
					ctx.stroke();
				}

				if ($scope.drawPeakForce) {
					if ($scope.path[i].f > $scope.path[i - 1].f && $scope.path[i].f > $scope.path[i + 1].f) {
						ctx.strokeStyle = "#f77";
						ctx.beginPath();
						ctx.moveTo($scope.path[i].x, -$scope.path[i].y);
						ctx.lineTo($scope.path[i].x + $scope.path[i].fx * forceScale, -$scope.path[i].y - $scope.path[i].fy * forceScale);
						ctx.stroke();
						ctx.font = "0.03px Consolas";
						ctx.fillText(formatForce($scope.path[i].f), $scope.path[i].x, -$scope.path[i].y);
					}
				}
			}
		}


		//draw cable
		ctx.strokeStyle = "#000";
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo($scope.particleX, -$scope.particleY);
		ctx.stroke();

		//draw particle
		ctx.lineWidth = 0.004;
		ctx.beginPath();
		ctx.arc($scope.particleX, -$scope.particleY, 10, 0, 2 * 3.141597);
		ctx.stroke();

		//draw reaction force vector
		ctx.strokeStyle = "#f00";
		ctx.beginPath();
		ctx.moveTo($scope.particleX, -$scope.particleY);
		ctx.lineTo($scope.particleX + $scope.forceX * $scope.forceScale, -$scope.particleY - $scope.forceY * $scope.forceScale);
		ctx.stroke();
	};
	
	$scope.stepSim = function(deltaT) {
		let oldForceX = $scope.forceX;
		let oldForceY = $scope.forceY;

		$scope.forceX = 0.0;
		$scope.forceY = -9.81 * $scope.particleMass;

		let dist = Math.sqrt($scope.particleX * $scope.particleX + $scope.particleY * $scope.particleY);
		if(dist > $scope.cableLength) {
			$scope.deltaL = dist - $scope.cableLength;
			$scope.strain = $scope.deltaL / $scope.cableLength;
			let force = getForce($scope.strain, $scope.E, $scope.cableRadius);

			if(force > $scope.maxForce) {
				$scope.maxForce = force;
				$scope.maxForce = $scope.maxForce.toFixed(3);
			}
			

			$scope.forceX = -force * $scope.particleX / dist;
			$scope.forceY = -force * $scope.particleY / dist;
		} else {
			$scope.forceX = 0;
			$scope.forceY = 0;
			$scope.deltaL = 0;
			$scope.strain = 0;
		}

		$scope.velocityX += $scope.forceX / $scope.particleMass * deltaT;
		$scope.velocityY += $scope.forceY / $scope.particleMass * deltaT - 9.81 * deltaT;

		$scope.particleX += $scope.velocityX * deltaT;
		$scope.particleY += $scope.velocityY * deltaT;

		$scope.time += deltaT;
		
		// formatting
		$scope.timeFormatted = $scope.time.toFixed(3)
		$scope.strainFormatted = $scope.strain.toFixed(3);
		$scope.forceXFormatted = $scope.forceX.toFixed(3);
		$scope.forceYFormatted = $scope.forceY.toFixed(3);
		let potentialEnergy = -($scope.particleY * $scope.particleMass * -9.81);
		let kinecticEnergy = 0.5 * ($scope.velocityX * $scope.velocityX + $scope.velocityY * $scope.velocityY) * $scope.particleMass;
		$scope.potentialEnergyFormatted = potentialEnergy.toFixed(3);
		$scope.kineticEnergyFormatted = kinecticEnergy.toFixed(3);
		$scope.elasticEnergyFormatted = -(potentialEnergy + kinecticEnergy).toFixed(3);
		
		$scope.path.push({'x': $scope.particleX, 'y': $scope.particleY, 'f': Math.sqrt($scope.forceX * $scope.forceX + $scope.forceY * $scope.forceY), 'fx': $scope.forceX, 'fy': $scope.forceY, 't': $scope.time});
	};
	
	$scope.resetSim = function() {
		$scope.particleX = $scope.x0;
		$scope.particleY = $scope.y0;
		$scope.velocityX = 0;
		$scope.velocityY = 0;
		$scope.path = [];
	};
	
	setInterval(function() {
		for(let i = 0; i < 10; i++) $scope.stepSim(0.0001);
		$scope.drawSim($scope);
		$scope.$apply();
	}, 10);
}]);


let showHide = function(panel) {
	let ele = document.getElementById(panel);
	let headerEle = null;
	let toggleEle = null;
	if (ele) {
		for (let i = 0; i < ele.childNodes.length; i++) {
			if (ele.childNodes[i].className == "panelHeader") {
				headerEle = ele.childNodes[i];
				break;
			}
		}
		if (headerEle) {
			for (let i = 0; i < headerEle.childNodes.length; i++) {
				if (headerEle.childNodes[i].className == "panelShowHide") {
					toggleEle = headerEle.childNodes[i];
					break;
				}
			}

			if (toggleEle) {
				if (toggleEle.innerText == "Hide") {
					toggleEle.innerText = "Show";
					for (let i = 0; i < ele.childNodes.length; i++) {
						if(ele.childNodes[i].className != "panelHeader" && ele.childNodes[i].style) ele.childNodes[i].style.display = 'none';
					}
				} else {
					toggleEle.innerText = "Hide";
					for (let i = 0; i < ele.childNodes.length; i++) {
						if (ele.childNodes[i].className != "panelHeader" && ele.childNodes[i].style) ele.childNodes[i].style.display = 'initial';
					}
				}
			}
		}
	}
};

window.onload = function () {
	document.getElementById("outerContainer").style.height = document.body.clientHeight + "px";

	advancedOptions = document.getElementById("advancedContent");
	canvasEle = document.getElementById("sim");

	canvasEle.width = document.body.clientWidth;
	canvasEle.height = document.body.clientHeight;
};