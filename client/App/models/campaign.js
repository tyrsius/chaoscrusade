define(['durandal/app', 'knockout', 'data/socketObservable', 'models/character', 'services/campaignService'],
function(app, ko, socketObservable, Character, campaignService) {
	var Campaign = function(init) {
		var self = this;

		var map = {
			id: init.id || '',
			name: init.name || '',
			gmId: init.gmId || ''
		};

		socketObservable.Model.call(self, 'campaign', map);

		self.characters = socketObservable.Set('character', Character, 'campaign', self.id);

		self.loadCharacters = function() {
			campaignService.getCharacters(self.id())
				.then(function(characters) {
					self.characters.loadSet(characters);
				})
				.fail(app.log).done();
		};

		self.charactersLoaded = ko.computed(function() {
			return self.characters().length > 0;
		});
	};

	return Campaign;
});	