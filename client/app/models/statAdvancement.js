define(['durandal/app', 'knockout', 'data/rules'], 
function(app, ko, rules, require) {

	var maxRank = rules.maxSkillRank,
		rankFactor = rules.statRankFactor;

	//Stats function very similarly to skills
	//Changes made here may also apply to skills, especially those related to XP costs
	return function(data) {
		var self = this,
			data = data || {};

		var map = {
			id: data.id || '',
			characterId: data.characterId || '',
			statId: data.statId || 0,
			baseValue: data.baseValue || 0,
			rank: data.rank || 0,
			xpSpent: data.xpSpent || []
		};

		ko.socketModel(self, 'statAdvancements', map);

		self.name = ko.computed(function() {
			return rules.stats[self.statId()].name;
		});

		self.abbr = ko.computed(function() {
			return rules.stats[self.statId()].abbr;
		});

		self.alignment = ko.computed(function() {
			return rules.stats[self.statId()].alignment;
		});

		//The cost of ranking up for each patron status
		self.rankUpCost = ko.computed(function() {

			var rankUp = self.rank() + 1;
			if (rankUp === (maxRank + 1))
				return 0;
			
			return {
				'True': rules.getStatCost('True', rankUp),
				Allied: rules.getStatCost('Allied', rankUp),
				Opposed: rules.getStatCost('Opposed', rankUp)
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
				return self.rank() > 0; //Stats can go to rank 0
			}
		});

		self.totalXpCost = ko.computed(function() {
			return self.xpSpent().sum();
		});

		//The value should not be writeable
		//If you need to change the value, use the baseValue
		self.value = ko.computed(function() {
			return self.baseValue().toNumber() + (self.rank().toNumber() * rankFactor);
		});
	};
});