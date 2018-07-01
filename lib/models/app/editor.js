export class Editor extends SFItem {

  constructor(json_obj) {
    super(json_obj);
    if(!this.notes) {
      this.notes = [];
    }
    if(!this.data) {
      this.data = {};
    }
  }

  mapContentToLocalProperties(content) {
    super.mapContentToLocalProperties(content)
    this.url = content.url;
    this.name = content.name;
    this.data = content.data || {};
    this.default = content.default;
    this.systemEditor = content.systemEditor;
  }

  structureParams() {
    var params = {
      url: this.url,
      name: this.name,
      data: this.data,
      default: this.default,
      systemEditor: this.systemEditor
    };

    var superParams = super.structureParams();
    Object.assign(superParams, params);
    return superParams;
  }

  referenceParams() {
    var references = _.map(this.notes, function(note){
      return {uuid: note.uuid, content_type: note.content_type};
    })

    return references;
  }

  addItemAsRelationship(item) {
    if(item.content_type == "Note") {
      if(!_.find(this.notes, item)) {
        this.notes.push(item);
      }
    }
    super.addItemAsRelationship(item);
  }

  removeItemAsRelationship(item) {
    if(item.content_type == "Note") {
      _.pull(this.notes, item);
    }
    super.removeItemAsRelationship(item);
  }

  removeAndDirtyAllRelationships() {
    super.removeAndDirtyAllRelationships();
    this.notes = [];
  }

  removeReferencesNotPresentIn(references) {
    super.removeReferencesNotPresentIn(references);

    var uuids = references.map(function(ref){return ref.uuid});
    this.notes.forEach(function(note){
      if(!uuids.includes(note.uuid)) {
        _.remove(this.notes, {uuid: note.uuid});
      }
    }.bind(this))
  }

  potentialItemOfInterestHasChangedItsUUID(newItem, oldUUID, newUUID) {
    if(newItem.content_type === "Note" && _.find(this.notes, {uuid: oldUUID})) {
      _.remove(this.notes, {uuid: oldUUID});
      this.notes.push(newItem);
    }
  }

  toJSON() {
    return {uuid: this.uuid}
  }

  get content_type() {
    return "SN|Editor";
  }

  setData(key, value) {
    var dataHasChanged = JSON.stringify(this.data[key]) !== JSON.stringify(value);
    if(dataHasChanged) {
      this.data[key] = value;
      return true;
    }
    return false;
  }

  dataForKey(key) {
    return this.data[key] || {};
  }
}
