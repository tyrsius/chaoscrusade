define(['durandal/app', 'knockout', 'data/rules', 'models/skill', 'require', 'data/dataContext'], 
function(app, ko, rules, Skill, require) {

	var maxRank = rules.maxSkillRank;

	return function(data) {
		var self = this,
			data = data || {},
			dataContext = require('data/dataContext');

		var map = {
			id: data.id || '',
			characterId: data.characterId || '',
			skillId: data.skillId || '',
			rank: data.rank || 0,
			xpSpent: data.xpSpent || []
		};

		ko.socketModel(self, 'skillAdvancements', map);

		//The cost of ranking up for each patron status
		self.rankUpCost = ko.computed(function() {

			var rankUp = self.rank() + 1;
			if (rankUp === (maxRank + 1))
				return 0;
			
			return {
				'True': rules.getSkillCost('True', rankUp),
				Allied: rules.getSkillCost('Allied', rankUp),
				Opposed: rules.getSkillCost('Opposed', rankUp)
			};
		});

		self.getRankUpCost = function(characterAlignment) {
			var patronStatus = rules.getPatronStatus(characterAlignment, self.alignment());
			return self.rankUpCost()[patronStatus];
		};

		//Rank up the skill and add the xp cost of the patron status
		self.rankUp = function(characterAlignment) {
			if (self.rank() === maxRank)
				return;

			var patronStatus = rules.getPatronStatus(characterAlignment, self.alignment());

			//We have to get the rankUpCost BEFORE rankingup,
			//since the rankUpCost shows the cost to rankUp from THE CURRENT RANK
			self.xpSpent.push(self.rankUpCost()[patronStatus]);

			self.rank(self.rank() + 1);

			return self.xpSpent().last();
		};

		self.rankDown = ko.command({
			execute: function() {
				self.xpSpent.pop();
				self.rank(self.rank() - 1);
			},
			canExecute: function() {
				return self.rank() > 1;
			}
		});
		
		self.skill = ko.computed(function() {
			return skill = dataContext.skills().find(function(s) {
				return s.id() === self.skillId();
			}) || new Skill();
		});

		self.name = ko.computed(function() {
			return self.skill().name();
		});

		self.alignment = ko.computed(function() {
			return self.skill().alignment();
		});

		self.totalXpCost = ko.computed(function() {
			return self.xpSpent().sum();
		});
	};
});