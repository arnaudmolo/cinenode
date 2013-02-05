// A simple module to replace `Backbone.sync` with *mongoStorage*-based
// persistence. Models are given GUIDS, and saved into a JSON object. Simple
// as that.

// Our Store is represented by a single JS object in *mongoStorage*. Create it
// with a meaningful name, like the name you'd give a table.

// Override `Backbone.sync` to use delegate to the model or collection's
// *mongoStorage* property, which should be an instance of `Store`.
Backbone.sync = function(method, model, options) {

  var resp;

  switch (method) {
    case "read":    resp = model.id ? store.find(model) : store.findAll(); break;
    case "create":  resp = store.create(model);                            break;
    case "update":  resp = store.update(model);                            break;
    case "delete":  resp = store.destroy(model);                           break;
  }

  if (resp) {
    options.success(model);
  } else {
    options.error("Record not found");
  }
};
