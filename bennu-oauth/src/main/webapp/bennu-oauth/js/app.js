/*
 * Copyright © 2015 Instituto Superior Técnico
 *
 * This file is part of Bennu OAuth.
 *
 * Bennu OAuth is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Bennu OAuth is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Bennu OAuth.  If not, see <http://www.gnu.org/licenses/>.
 */
var bennuOAuth = angular.module('bennuOAuth', [
                                               'ngRoute', 'pascalprecht.translate', 'bennuToolkit'
                                               ]);

bennuOAuth.filter('scopeNames', ['$filter', function($filter) {	
	return function(scopes) {
		var names = [];		
		var i18n = $filter('i18n');
		angular.forEach(scopes, function(scope) {
			names.push(i18n(scope.name));
		});		
		return names.join(", ");
	}
}]);

bennuOAuth.factory('httpUnauthorizedFilter', ['$window', function httpUnauthorizedFilter($window) {

	return {
		responseError : function(response) {
			if (response.status === 401) { // unauthorized
				$window.location.href = window.contextPath + "/login";
			}
		}
	};
}]);

function createReloadableUrlObject(application, logoUrlField) {
	if (!logoUrlField) {
		logoUrlField = 'logoUrl';
	}

	if(!application[logoUrlField]) {
		return application;
	}
	application.getLogoUrl = application[logoUrlField] + "?cb=" + (new Date()).getTime();
	return application;
}

function getReloadableUrlObjects(data, logoUrlField) {
	angular.forEach(data, function(app) {
		createReloadableUrlObject(app, logoUrlField);
	});
	return data;
}

function fileNameChangedAux(e, type, $scope){
	var files = e.files; // FileList object
	$scope.error = '';
	for ( var i = 0; i < files.length; i++) {
		var file = files[i];
		if (!file.type.match("image.*")) {
			$scope.$apply(function () {
				$scope.error = "Only images";
			});
			continue;
		}
		if (file.size > 2000 * 1024) { // 2000kb
			$scope.$apply(function () {
				$scope.error = "Image too large. Maximum size : 2MB";
			});
			continue;
		}
		var reader = new FileReader();
		reader.onload = (function(f) {
			return function(e) {
				var content = e.target.result;
				var picBase64 = content.substr(content.indexOf(",") + 1, content.length);
				if(type === "logo"){
					$scope.$apply(function () {
						$scope.currentapp.logo = picBase64;
					});
				}
			};
		})(file);
		reader.readAsDataURL(file);
	}
}

bennuOAuth.config(['$routeProvider','$httpProvider','$translateProvider',
                   function($routeProvider, $httpProvider, $translateProvider) {
	$routeProvider.
	when('/authorizations', {
		templateUrl: contextPath + '/bennu-oauth/template/Authorizations.html',
		controller: 'AuthorizationsCtrl'
	}).
	when('/authorizations/:id', {
		templateUrl: contextPath + '/bennu-oauth/template/AuthorizationsById.html',
		controller: 'AuthorizationsByIdCtrl'
	}).
	when('/authorizations-user/:id', {
		templateUrl: contextPath + '/bennu-oauth/template/AuthorizationsByUser.html',
		controller: 'AuthorizationsByUserCtrl'
	}).   
	when('/applications', {
		templateUrl: contextPath + '/bennu-oauth/template/Applications.html',
		controller: 'ApplicationsCtrl'
	}).
	when('/service-applications', {
		templateUrl: contextPath + '/bennu-oauth/template/ServiceApplications.html',
		controller: 'ServiceApplicationsCtrl'
	}).
	when('/manage', {
		templateUrl: contextPath + '/bennu-oauth/template/Manage.html',
		controller: 'ManageCtrl'
	}).
	otherwise({
		redirectTo: '/authorizations'
	});

	$httpProvider.interceptors.push('httpUnauthorizedFilter');

	$translateProvider.useStaticFilesLoader({
		prefix: window.contextPath + "/bennu-oauth/i18n/",
		suffix: '.json'
	});
	
	console.log(Bennu.locale.lang);
	$translateProvider.preferredLanguage(Bennu.locale.lang);

}]);

bennuOAuth.controller('AuthorizationsCtrl', [ '$scope', '$http', '$location', function ($scope, $http, $location) {

	$scope.ctx = contextPath;

	$scope.predicate = 'applicationName';

	$http.get(contextPath + '/api/bennu-oauth/authorizations').success(function (data) {
		$scope.authorizations = getReloadableUrlObjects(data, 'applicationLogoUrl');
	});

	$scope.showRevokeModal = function(authorization) {
		$scope.selectedAuthorization = authorization;
		$('#modal-revoke-menu').modal('show');
	};

	$scope.showDetails = function(authorization) {
		$scope.selectedAuthorization = authorization;
		$location.url('/authorizations/'+authorization.id);
	};

	$scope.revokeApp = function() {
		var index = $scope.authorizations.indexOf($scope.selectedAuthorization);
		$http.delete(contextPath + '/api/bennu-oauth/authorizations/' + $scope.selectedAuthorization.id).success(function () {
			if (index > -1) {
				$scope.authorizations.splice(index, 1);
			}
		});
	};

	$scope.filterApplications = function(value, index) {
		var found = false;
		angular.forEach(['applicationName', 'applicationAuthor', 'applicationDescription', 'applicationSiteUrl'], function(key) {
			if (!$scope.query || value[key].toLowerCase().indexOf($scope.query.toLowerCase()) >= 0) {
				found = true;
				return;
			}
		});
		return found;
	};
}]);

bennuOAuth.controller('AuthorizationsByIdCtrl', [ '$scope', '$http', '$routeParams', '$location', function ($scope, $http, $routeParams, $location) {

	$scope.ctx = contextPath;

	$scope.predicate = '-date';

	$http.get(contextPath + '/api/bennu-oauth/sessions/' + $routeParams.id ).success(function (data) {
		$scope.sessions = data;		
	});	

	$scope.showRevokeSessionModal = function(session) {
		$scope.selectedSession = session;
		$('#modal-revoke-session-menu').modal('show');
	};

	$scope.revokeSession = function() {	
		$http.delete(contextPath + '/api/bennu-oauth/sessions/' + $scope.selectedSession.id).success(function () {
			$http.get(contextPath + '/api/bennu-oauth/sessions/' + $routeParams.id ).success(function (data) {
				$scope.sessions = data;		
			});	
		});
	};

}]);

bennuOAuth.controller('AuthorizationsByUserCtrl', [ '$scope', '$http', '$routeParams', '$location', function ($scope, $http, $routeParams, $location) {

	$scope.ctx = contextPath;

	$scope.predicate = '-authorizations';

	$http.get(contextPath + '/api/bennu-oauth/applications/' + $routeParams.id + '/authorizations').success(function (data) {
		$scope.authorizations = data;		
	});

	$scope.showSessionsApplication = function(authorization) {
		$location.url('/authorizations/' + authorization.id);
	};

	$scope.showRevokeModal = function(authorization) {
		$scope.selectedAuthorization = authorization;
		$('#modal-revoke-menu').modal('show');
	};

	$scope.revokeApp = function() {
		var index = $scope.authorizations.indexOf($scope.selectedAuthorization);
		$http.delete(contextPath + '/api/bennu-oauth/authorizations/' + $scope.selectedAuthorization.id).success(function () {
			if (index > -1) {
				$scope.authorizations.splice(index, 1);
			}
		});
	};

	$scope.filterAuthorizations = function(value, index) {
		var found = false;
		angular.forEach(['name'], function(key) {
			if (!$scope.query || value[key].toLowerCase().indexOf($scope.query.toLowerCase()) >= 0) {
				found = true;
				return;
			}
		});
		return found;
	};

}]);

bennuOAuth.controller('ApplicationsCtrl', [ '$scope', '$http', '$cacheFactory', '$timeout', function ($scope, $http, $cacheFactory, $timeout) {

	$scope.ctx = contextPath;

	$scope.predicate = 'name';
	$scope.predicateScope = 'name';

	$http.get(contextPath + '/api/bennu-oauth/applications').success(function (data) {		
		$scope.applications = getReloadableUrlObjects(data);
	});

	$http.get(contextPath + '/api/bennu-oauth/scopes').success(function (data) {
		$scope.scopes = data;
	});

	$scope.create = function() {
		$('#createApplication').modal('hide');
		$http.post(contextPath + '/api/bennu-oauth/applications', $scope.currentapp).success(function (data) {
			$http.get(contextPath + '/api/bennu-oauth/applications').success(function (data) {
				$scope.applications = getReloadableUrlObjects(data);
			});
		});
	};

	$scope.update = function() {
		$('#editApplication').modal('hide');
		$http.put(contextPath + '/api/bennu-oauth/applications/' +  $scope.currentapp.id, $scope.currentapp).success(function (data) {
			if ($scope.currentappindex > -1) {
				$scope.applications[$scope.currentappindex] = createReloadableUrlObject(data);
			}
		});
	};

	$scope.deleteApp = function() {
		var index = $scope.applications.indexOf($scope.currentapp);
		$http.delete(contextPath + '/api/bennu-oauth/applications/' + $scope.currentapp.id).success(function () {
			if (index > -1) {
				$scope.applications.splice(index, 1);				
			}			
		});
	};

	$scope.showCreateApplication = function() {
		angular.element('#logo').val(null);
		$scope.error = "";
		$scope.currentapp = {logo : null, name : "", description : "" , siteUrl : "", redirectUrl : "", scopes : []};
		$('#createApplication').modal('show');
	};

	$scope.showDetailsApplication = function(application) {
		$scope.currentappindex = $scope.applications.indexOf(application);
		$scope.currentapp = angular.copy(application);
		$('#detailsApplication').modal('show');
	};

	$scope.showEditApplication = function(application) {
		angular.element('#editlogo').val(null);
		$scope.error = "";
		$scope.currentappindex = $scope.applications.indexOf(application);
		$scope.currentapp = angular.copy(application);
		$('#editApplication').modal('show');	
	};	

	$scope.ifChecked = function(app, scope) {
		if (app) {
			var found = false;
			angular.forEach(app.scopes, function(key) {
				if(key.id === scope.id) {
					found = true;
					return;
				}
			});		
			return found;
		}
		return false;
	}

	$scope.toggleSelection = function toggleSelection(app, scope) {
		if (app) {
			var idx = -1;
			var i = 0;
			angular.forEach(app.scopes, function(key) {
				if(key.id === scope.id) {
					idx = i;
					return;
				} 
				i++;
			});			
			if (idx > -1) {
				app.scopes.splice(idx, 1);
			} else {
				app.scopes.push(scope);
			}
		}
	};

	$scope.showDeleteModal = function(application) {
		$scope.currentappindex = $scope.applications.indexOf(application);
		$scope.currentapp = application;
		$('#modal-delete-menu').modal('show');
	};

	$scope.fileNameChanged = function(e, type) {
		fileNameChangedAux(e, type, $scope);
	};

	$scope.filterApplications = function(value, index) {
		var found = false;
		angular.forEach(['name', 'description', 'siteUrl'], function(key) {
			if (!$scope.query || value[key].toLowerCase().indexOf($scope.query.toLowerCase()) >= 0) {
				found = true;
				return;
			}
		});
		return found;
	};

}]);

bennuOAuth.controller('ManageCtrl', [ '$scope', '$http', '$location', '$filter', function ($scope, $http, $location, $filter) {
	
	$scope.i18n = $filter('i18n');

	$scope.ctx = contextPath;

	$scope.applicationsBaseApiUrl = $scope.applicationsBaseApiUrl || '/api/bennu-oauth/applications/';

	$scope.predicate = 'scopeKey';

	$scope.predicateApplications = '-authorizations';


	$http.get(contextPath + '/api/bennu-oauth/scopes/all').success(function (data) {
		$scope.scopes = data;
	});
	
	$http.get(contextPath + '/api/bennu-oauth/scopes').success(function (data) {
		$scope.userscopes = data;
	});

	$http.get(contextPath + $scope.applicationsBaseApiUrl + 'all').success(function (data) {
		$scope.applications = getReloadableUrlObjects(data);
		//$scope.originalApplications = getReloadableUrlObjects(data);
	});
	
	$scope.ifChecked = function(app, scope) {
		if (app) {
			var found = false;
			angular.forEach(app.scopes, function(key) {
				if(key.id === scope.id) {
					found = true;
					return;
				}
			});		
			return found;
		}
		return false;
	}

	$scope.toggleSelection = function toggleSelection(app, scope) {
		if (app) {
			var idx  = -1;
			var i = 0;
			angular.forEach(app.scopes, function(key) {
				if(key.id === scope.id) {
					idx = i;
					return;
				}
				i++;
			});			
			if (idx > -1) {
				app.scopes.splice(idx, 1);
			} else {
				app.scopes.push(scope);
			}
		}
	};

	$scope.create = function() {
		$('#addScope').modal('hide');		
		$http.post(contextPath + '/api/bennu-oauth/scopes', $scope.currentscope).success(function (data) {
			$http.get(contextPath + '/api/bennu-oauth/scopes/all').success(function (data) {
				$scope.scopes = data;
			});
		});
	};

	$scope.update = function() {
		$('#editScope').modal('hide');
		$http.put(contextPath + '/api/bennu-oauth/scopes/' + $scope.currentscope.id, $scope.currentscope).success(function () {			
			$http.get(contextPath + '/api/bennu-oauth/scopes/all').success(function (data) {
				$scope.scopes = data;
			});
		});
	};

	$scope.deleteScope = function() {		
		$http.delete(contextPath + '/api/bennu-oauth/scopes/' + $scope.currentscope.id).success(function () {			
			$http.get(contextPath + '/api/bennu-oauth/scopes/all').success(function (data) {
				$scope.scopes = data;
			});
		});
	};

	$scope.updateApplication = function() {
		$('#editApplicationManager').modal('hide');
		$http.put(contextPath + $scope.applicationsBaseApiUrl +  $scope.currentapp.id, $scope.currentapp).success(function (data) {
			if ($scope.currentappindex > -1) {
				$scope.applications[$scope.currentappindex] = createReloadableUrlObject(data);
			}
		});
	};

	$scope.fileNameChanged = function(e, type) {
		fileNameChangedAux(e, type, $scope);
	};

	$scope.showDeleteModal = function(scope) {
		$scope.currentscope = Object.create(scope);
		$('#modal-delete-menu').modal('show');
	};

	$scope.showEditModal = function(scope) {
		$scope.currentscope = Object.create(scope);
		$('#editScope').modal('show');
	};

	$scope.showAuthorizationsApplication = function(application) {
		$scope.currentapp = application;
		$location.url('/authorizations-user/'+application.id);
	};

	$scope.showCreateScope = function() {
		$scope.currentscope = {};
		$('#addScope').modal('show');
	};

	$scope.showBanModal = function(application) {
		$scope.currentapp = application;
		$('#modal-ban-menu').modal('show');
	};

	$scope.showUnbanModal = function(application) {
		$scope.currentapp = application;
		$('#modal-unban-menu').modal('show');
	};

	$scope.showDeleteApplicationModal = function(application) {
		$scope.currentapp = application;
		$('#modal-delete-application-menu').modal('show');
	};

	$scope.banApplication = function() {
		var index = $scope.applications.indexOf($scope.currentapp);
		$http.put(contextPath + $scope.applicationsBaseApiUrl + $scope.currentapp.id + '/ban').success(function () {
			$scope.applications[index].state = "Banned";
		});
	};

	$scope.activeApplication = function() {
		var index = $scope.applications.indexOf($scope.currentapp);
		$http.put(contextPath + $scope.applicationsBaseApiUrl + $scope.currentapp.id + '/active').success(function () {
			$scope.applications[index].state = "Active";
		});
	};

	$scope.deleteApplication = function() {
		var index = $scope.applications.indexOf($scope.currentapp);
		$http.delete(contextPath + $scope.applicationsBaseApiUrl + $scope.currentapp.id).success(function () {
			$scope.applications[index].state = "Deleted";
		});
	};

	$scope.filterApplications = function(value, index) {
		var found = false;
		angular.forEach(['name', 'description', 'author', 'state', 'redirectUrl'], function(key) {
			if (!$scope.query || value[key].toLowerCase().indexOf($scope.query.toLowerCase()) >= 0) {
				found = true;
				return;
			}
		});
		return found;
	};

	$scope.filterScopes = function(value, index) {
		
		if (!$scope.queryScopes) {
			return true;
		}
		
		var query = $scope.queryScopes.toLowerCase();
		
		if (value['scopeKey'].toLowerCase().indexOf(query) >= 0) {
			return true;
		}
		
		if ($scope.i18n(value['name']).toLowerCase().indexOf(query) >= 0) {
			return true;
		}
		
		if ($scope.i18n(value['description']).toLowerCase().indexOf(query) >= 0) {
			return true;
		}	
		return false;
	};

	$scope.showDetailsApplication = function(application) {
		$scope.currentapp = application;
		$('#detailsApplication').modal('show');
	};

	$scope.showEditApplicationModal = function(application) {
		angular.element('#logo').val(null);
		$scope.currentappindex = $scope.applications.indexOf(application);
		$scope.currentapp = angular.copy(application);
		$('#editApplicationManager').modal('show');
	};

	$scope.btnFilter = function(state, type) {
		if (type == 'Edit') {
			if(state != 'Deleted') {
				return true;
			}
		} else if (type == 'Ban') {
			if(state != 'Deleted' && state != 'Banned') {
				return true;
			}
		} else if (type == 'Unban') {			
			if(state != 'Deleted' && state == 'Banned') {
				return true;
			}			
		} else if (type == 'Delete') {
			if(state != 'Deleted') {
				return true;
			}
		}
		return false;
	}

	$scope.keyChange = function() {
		var found = false;

		angular.forEach($scope.scopes, function(scope) {
			if(scope.scopeKey === $scope.currentscope.scopeKey) {
				found = true;
			} 
		});
		$scope.error = found;

	};
}]);

bennuOAuth.controller('ServiceApplicationsCtrl', ['$scope', '$http', '$controller', function ($scope, $http, $controller) {

	$scope.applicationsBaseApiUrl = '/api/bennu-oauth/service-applications/';
	
	$scope.newIp = '';
	
	$scope.addNewIp = function() {
		var whitelist = $scope.currentapp.ipAddresses;
		if ($scope.newIp && whitelist.indexOf($scope.newIp) === -1) {
			$scope.currentapp.ipAddresses.push($scope.newIp);
			$scope.newIp = '';
		}
	};
	
	$scope.removeIp = function(ip) {
		var whitelist = $scope.currentapp.ipAddresses;
		whitelist.splice(whitelist.indexOf(ip), 1);
	};
		

	$controller('ManageCtrl', {$scope : $scope});

	$scope.showCreateApplication = function() {
		angular.element('#logo').val(null);
		$scope.error = "";
		$scope.currentapp = {logo : null, name : "", scopes : [], description : "" , siteUrl : "", redirectUrl : "", ipAddresses : []};
		$scope.scopes = angular.copy($scope.scopes);		
		$('#createApplication').modal('show');
	};

	$scope.createApplication = function() {
		$('#createApplication').modal('hide');
		$http.post(contextPath + $scope.applicationsBaseApiUrl, $scope.currentapp).success(function (data) {
			$http.get(contextPath + $scope.applicationsBaseApiUrl + 'all').success(function (data) {
				$scope.applications = getReloadableUrlObjects(data);
			});
		});
	};
}]);
