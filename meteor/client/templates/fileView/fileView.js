Template.fileView.filesWithId = function() {
  return Images.find({
    folderId: Session.get("currentFolderId")
  });
}

Template.fileView.foldersWithParent = function() {
  return Folders.find({
    parent: Session.get("currentFolderId")
  });
}

Template.fileView.hasFiles = function() {
  if (Images.find({
    folderId: Session.get("currentFolderId")
  }).count() == 0) {
    return false;
  }
  return true;
}

Template.fileView.hasFolders = function() {
  if (Folders.find({
    parent: Session.get("currentFolderId")
  }).count() == 0) {
    return false;
  }
  return true;
}

Template.fileView.hasNothing = function() {
  if (!(Template.fileView.hasFiles() || Template.fileView.hasFolders())) {
    return true;
  }
  return false;
}

Template.fileView.removeFolder = function() {
  if (confirm("Do you really want to delete this folder? Deleting a folder strands all of the files within it.")) {
    Meteor.call('deleteFolder', Session.get("currentFolderId"), function(err, result) {
      if (err) {
        alert(err);
      } else if (result !== "Success") {
        alert(result);
      } else {
        Session.set("currentView", "viewingFirstScreen");
      }
    });

  }
}
Template.fileView.getFolderName = function() {
  var folder = Folders.findOne({
    _id: Session.get("currentFolderId")
  });
  if (typeof(folder) !== "undefined") {
    return folder.name;
  } else {
    return "";
  }
}

Template.fileView.setImageSessionVars = function() {
  var imageObject = Images.findOne(Session.get("currentImageId"));
  Session.set("currentImageNumFrames", imageObject.numFrames);
  Session.set("currentFrameIndex", 0);
  Session.set("currentFrameURL", imageObject.webPath[0]);
  Session.set("startFrameIndex", 0);
  Session.set("endFrameIndex", 0);
  Session.set("imageSliderMax", imageObject.numFrames - 1);
  Session.set("imageSliderMin", 0);
  //optics
  Session.set("op_pitch", imageObject.op_pitch);
  Session.set("op_flen", imageObject.op_flen);
  Session.set("op_mag", imageObject.op_mag);
  Session.set("op_na", imageObject.op_na);
  Session.set("op_medium", imageObject.op_medium);
  //lenslets
  Session.set("op_x_offset", imageObject.op_x_offset);
  Session.set("op_y_offset", imageObject.op_y_offset);
  Session.set("op_right_dx", imageObject.op_right_dx);
  Session.set("op_right_dy", imageObject.op_right_dy);
  Session.set("op_down_dx", imageObject.op_down_dx);
  Session.set("op_down_dy", imageObject.op_down_dy);
  //rendering stuff
  Session.set("currentImageGain", imageObject.defaultGain);
  Session.set("currentImageGamma", imageObject.defaultGamma);


}

Template.fileView.events = {
  'mouseenter .fileViewRow': function(e) {
    $(e.target).children().addClass("fileViewRowActive");
  },
  'mouseleave .fileViewRow': function(e) {
    $(e.target).children().removeClass("fileViewRowActive");
  },
  'click .fileViewRow': function(e) {
    Session.set("currentImageId", $(e.target).parent().attr("fileid"));
    Template.fileView.setImageSessionVars();
    Session.set("currentImageView", "viewingImage");
    Session.set("currentWebGLMode", "image");
    $("#rendermode").val("image");
    newmode("image");
    render(image, 1);
  },
  'dragstart .fileViewRow': function(e) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text', e.target.cells[0].innerHTML); // id
  },
  'click #removeFolder': function(e) {
    e.preventDefault();
    Template.fileView.removeFolder();
  },
  'click .folderViewRow': function(e) {
    Session.set("currentFolderId", $(e.target).parent().attr("folderId"));
  }
}