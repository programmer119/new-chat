if (!Module.preRun) Module.preRun = [];
Module.preRun.push(function() {
  FS.createPreloadedFile("/", "data.pck", "data.pck?v=v1-godot-startup-2", true, true);
});
