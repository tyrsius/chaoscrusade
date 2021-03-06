module.exports = function(app, setName, itemName) {
	var seperator = '|',
		db = app.db,
		collection = db[setName];

	var removeDoc = function(collection, id, callback) {
		//if we have any cascade children, we need to remove them first
		//Failing on them means the parent will still be around to try again
		if (collection.children.length > 0) {

			try {
				collection.findById(id, function(error, doc) {
					if (error) {
	            		callback(new app.errors.ServerError('Unable to delete '+itemName+'.'));
		            }
		            else {
		           		collection.children.forEach(function(child) {
							db[child].find().where('_id').in(doc[child]).remove(function(err) {
								if (err)
									throw new Error();
							});
						});

						doc.remove(function(err) {
							if (!err) {
				            	callback(null, [setName, 'removed'].join(seperator), id);
				            }
				            else {
				            	callback(new app.errors.ServerError('Unable to delete '+itemName+'.'));
				            }
						});
		            }
				});
			} catch (e) {
				callback(new app.errors.ServerError('Unable to delete '+itemName+'.'));
			}
			
		} else {
			collection.remove({ _id: id}, function(error) {
	            if (!error) {
	            	callback(null, [setName, 'removed'].join(seperator), id);
	            }
	            else {
	            	callback(new app.errors.ServerError('Unable to delete '+itemName+'.'));
	            }
	        });
		}	
	};

	return {
		get: function(callback) {
			collection.find().exec(function(error, docs){
				callback(error, null, docs);
	        });
		},
		getChildren: function(id, childModel, callback) {
			collection.findById(id).populate(childModel).exec(function(error, doc) {
				callback(error, null, doc[childModel]);
			});
		},
		insert: function(itemToAdd, callback) {
			collection.create(itemToAdd, function(error, doc) {
		        if (!error) {
		        	callback(null, [setName, 'added'].join(seperator), doc);
		        } else {
		        	callback(new app.errors.ServerError('Unable to add '+itemName+'.'));
		        }
		    });
		},
		insertChild: function(id, childModel, childItem, callback) {
			//If the model has an array field, not a child set
			if (!collection.schema.paths[childModel].options.type[0].ref) {
				collection.findById(id, function(error, doc) {
					if (!error) {
						doc[childModel].push(childItem);
						
						doc.save(function(error) {
							if (!error)
								callback(null, [setName, id, childModel, 'added'].join(seperator), childItem);
							else
								callback(new app.errors.ServerError('Unable to update '+itemName+'.'));
						});

					} else {
						callback(new app.errors.ServerError('Unable to load '+itemName+'.'));
					}
				});

			//The model has a child set
			} else {
				var childCollection = db[childModel],
					childId = childItem.id;

				var addToParent = function(childDoc) {
					collection.findById(id, function(error, doc) {
						if (!error) {
							doc[childModel].push(childId);
							
							doc.save(function(error) {
								if (!error)
									callback(null, [setName, id, childModel, 'added'].join(seperator), childDoc);
								else
									callback(new app.errors.ServerError('Unable to update '+itemName+'.'));
							});

						} else {
							callback(new app.errors.ServerError('Unable to load '+itemName+'.'));
						}
					});
				}

				//We need to create the child first if it doesn't exist
				childCollection.findById(childItem.id, function(error, childCheck) {
					if (!error)
						addToParent(childCheck);
					else {
						childCollection.create(childItem, function(error, childDoc) {
					        if (error) {
					        	callback(new app.errors.ServerError('Unable to add '+itemName+'.'));				        	
					        } else {
					        	childId = childDoc.id;
					        	addToParent(childDoc);
					        }
					    });
					}
				});		
			}	
		},
		remove: function(id, callback) {
			removeDoc(collection, id, callback)
		},
		removeChild: function(id, childModel, childId, callback) {
			//Model has a simple array propery
			if (!collection.schema.paths[childModel].options.type[0].ref) {
				collection.findById(id, function(error, doc) {
					if (!error) {
						//Child id is the index here
						doc[childModel].splice(childId, 1);						
						doc.save(function(error) {
							if (!error)
								callback(null, [setName, id, childModel, 'removed'].join(seperator), childId);
							else
								callback(new app.errors.ServerError('Unable to update '+itemName+'.'));
						});

					} else {
						callback(new app.errors.ServerError('Unable to load '+itemName+'.'));
					}
				});
			//Model has child set property
			} else {
				collection.findById(id, function(error, doc) {
					if (error) {
						callback(new app.errors.ServerError('Unable to remove '+ childModel +' from '+itemName+'.'));

					} else {
						var removeChildFromParent = function() {

							doc[childModel].remove(childId);

							doc.save(function(error) {
								if (!error)
									callback(null, [setName, id, childModel, 'removed'].join(seperator), childId);
								else
									callback(new app.errors.ServerError('Unable to update '+itemName+'.'));
							});	
						};

						//If we need to cascade the child delete, the child has to go first
						if (doc.shouldDeleteChild(childModel)) {
							removeDoc(db[childModel], childId, function(error) {
								if (error)
									callback(new app.errors.ServerError('Unable to remove '+ childModel +' from '+itemName+'.'));
								else
									removeChildFromParent();
							});
						} else {
							removeChildFromParent();
						}
					}
				});
			}
		},
		update: function(modelId, property, newValue, callback) {
			collection.findById(modelId, function(error, doc) {
				if (!error) {
					doc[property] = newValue;
					
					doc.save(function(error) {
						if (!error)
							callback(null, [setName, modelId, property, 'changed'].join(seperator), newValue);
						else
							callback(new app.errors.ServerError('Unable to update '+itemName+'.'));
					});

				} else {
					callback(new app.errors.ServerError('Unable to load '+itemName+'.'));
				}
			});
		}
	}
};