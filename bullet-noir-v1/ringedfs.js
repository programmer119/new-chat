if (!Module.preRun) Module.preRun = [];
Module.preRun.push(function() {
  FS.createPreloadedFile("/", "data.pck", "data.pck", true, true);
});
