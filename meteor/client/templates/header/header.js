Template.header.events = {
  'click #triggerAbout': function() {
    urlrouter.about();
  },
  'click #triggerHelp': function() {
    urlrouter.help();
  },
  'click #triggerFirstScreen': function() {
    urlrouter.main();
  },
  'change #useAmazonData': function(ev) {
    Session.set("useAmazonData", ev.currentTarget.checked);
  }
}

Template.header.connectionStatus = function() {
  return Meteor.status().status;
}

Template.header.searchtest = function(searchterm) {
  Meteor.call('search', searchterm, "autocomplete", function(err, result) {
    console.log(result);
    if (err) {
      console.log(err);
    }
  });
}

Template.header.rendered = function() {
  $('#useAmazonData').prop('checked', Session.get('useAmazonData'));
  $('#annotationSearch').typeahead({
    items: 10,
    minLength: 2,
    updater: function(item) {
      urlrouter.search(item);
      $("body").animate({
        scrollTop: 0
      }, "slow");
    },
    source: function(query, process) {
      Meteor.call('search', ".*" + query.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1") + ".*", "autocomplete", function(err, result) {
        if (result && result.length) {
          result.unshift(query.trim());
        } else if (result.length == 0) {
          result = ["No results were found for " + query];
        }
        process(result);
      });
    }
  });
}
