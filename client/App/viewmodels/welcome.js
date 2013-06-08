define(['durandal/app', 'models/campaign', 'modules/campaignService'],
function(app, Campaign, campaignService) {

    var Welcome = function() {
        var self = this;

        self.campaigns = ko.observableArray();
        self.campaignCount = ko.observable();

        self.campaignEntry = ko.observable();
        self.addCampaign = function() {
        	campaignService.createCampaign({ name: self.campaignEntry() })
        		.then(function(response) {
        			self.campaigns.push(new Campaign(response));
        			self.campaignEntry('');
        		}).fail(app.log).done();
        };

        self.deleteCampaign = function(campaign) {
        	campaignService.deleteCampaign(campaign.id())
        		.then(function(response) {
        			self.campaigns.remove(campaign);
        		}).fail(app.log).done();
        };

        campaignService.getCampaigns()
	        .then(function(response) {
	        	self.campaigns.map(response.campaigns, Campaign);
	        	self.campaignCount(resonse.count);
	        }).fail(app.log).done();

    };
    
    return new Welcome();
});