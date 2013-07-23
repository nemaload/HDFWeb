Session.setDefault("currentFolderId", null);
Session.setDefault("userIsAdmin", false);
Session.setDefault("currentView", "viewingFirstScreen");
Session.setDefault("currentImageId", null);
Session.setDefault("currentImageView", "viewingNothing");
Session.setDefault("currentImageType", "ls");
Session.setDefault("currentWebGLMode", "3d");
Session.setDefault("currentFrameIndex", 0); //frameindex
Session.setDefault("startFrameIndex", 0);
Session.setDefault("endFrameIndex", 0);
Session.setDefault("currentSearchTerm", "");
Session.setDefault("searchJSON", "{}");
//image slider related things
Session.setDefault("currentImageNumFrames", 1);
Session.setDefault("imageSliderMin", 0);
Session.setDefault("imageSliderMax", 0);
Session.setDefault("currentAnnotationId", "");
//Annotation related functions
Session.setDefault("writingComment", false);
Session.setDefault("viewingAnnotation", false);
//rendering related things
Session.setDefault("currentImageGain", 0);
Session.setDefault("currentImageGamma", 1);

//How to change to local rendering mode
Session.setDefault("useAmazonData",true);

//Preloading
Session.setDefault("loadedLiveData",false);
