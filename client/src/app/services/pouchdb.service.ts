import { VinModel } from './../models/cellar.model';
import { Injectable } from '@angular/core';
import * as PouchDB from 'pouchdb/dist/pouchdb';
import { Subject, from, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';

import * as Debugger from 'debug';
const debug = Debugger('app:pouchdbService');

type eventTypes =
	| 'docInsert'
	| 'docUpdate'
	| 'docDelete'
	| 'dbReplicationStarted'
	| 'dbReplicationCompleted'
	| 'dbReplicationFailed'
	| 'dbSyncStarted'
	| 'dbSynchronized'
	| 'dbSyncFailed'
	| 'winesReadyToLoad';

type dbEventsType = {
	doc?;
	eventType: eventTypes; // can be either 'docInsert', 'docUpdate', 'docDelete', 'dbReplicationStarted','dbReplicationCompleted','dbReplicationFailed','dbSyncStarted','dbSynchronized','dbSyncFailed'
};

@Injectable({
	providedIn: 'root'
})
export class PouchdbService {
	db: any;
	remote: string = 'http://127.0.0.1:5984/notes';
	//dbEvents$: Subject<any> = new Subject();
	dbEvents$: Subject<dbEventsType> = new Subject();
	syncOptions = {
		live: true,
		retry: true
	};

	constructor() {
		this.db = new PouchDB('cellar' /* ,{revs_limit: 1, auto_compaction: true} */);
		this.remote = window.localStorage.getItem('myCellar.remoteDBURL');
		debug('[DataService constructor]calling syncLocalWithRemote');
		this.syncLocalwithRemote();
		this.execHooks();
	}

	syncLocalwithRemote() {
		if (this.remote && this.remote.startsWith('http')) {
			this.db
				.sync(this.remote, this.syncOptions)
				.on('changed', (info) => debug('[syncLocalwithRemote]sync changed - info :' + JSON.stringify(info)))
				.on('paused', (info) => {
					this.dbEvents$.next({ eventType: 'dbSynchronized' });
					debug('[syncLocalwithRemote]sync paused - replication completed - info :' + JSON.stringify(info));
				})
				.on('failed', (error) => {
					this.dbEvents$.next({ eventType: 'dbSyncFailed' });
					debug('[syncLocalwithRemote]replication failed with error : ' + error);
				});
			this.dbEvents$.next({ eventType: 'dbSyncStarted' });
			debug('[syncLocalwithRemote]replication started');
			return this.dbEvents$;
		}
	}

	replicateRemoteToLocal() {
		this.db.destroy().then((response) => {
			console.info('database destroyed');
			this.db = new PouchDB('notes' /* ,{revs_limit: 1, auto_compaction: true} */);
			// replicate remote DB to local
			this.dbEvents$.next({ eventType: 'dbReplicationStarted' });
			debug('[replicateRemoteToLocal]replication started');
			// do one way, one-off sync from the server until completion
			this.db.replicate
				.from(this.remote)
				.on('complete', (info) => {
					// then two-way, continuous, retriable sync
					this.dbEvents$.next({ eventType: 'dbReplicationCompleted' });
					debug('[replicateRemoteToLocal]replication completed');
					this.db.sync(this.remote, this.syncOptions);
				})
				.on('error', () => {
					this.dbEvents$.next({ eventType: 'dbReplicationFailed' });
					debug('[replicateRemoteToLocal]replication failed');
				});
		});
		return this.dbEvents$;
	}

	getChanges$(): Observable<any> {
		return Observable.create((observer) => {
			// Listen for changes on the database.
			this.db.changes({ live: true, since: 'now', include_docs: true }).on('change', (change) => {
				// Convert string to date, doesn't happen automatically.
				change.doc.Date = new Date();
				observer.next(change);
			});
		});
	}

	execHooks() {
		//let allDBChanges = this.getChanges$();
		this.dbEvents$
			.pipe(
				// we will filter event to keep only updates as only those events will need to adjust all wines records which contain the modified or deleted element (type, origine or appellation)
				filter((event) => event.eventType == 'docUpdate')
			)
			.subscribe((event) => {
				debug('[execHooks]updates wines');
				let winesToUpdate = [];
				let letChangedDocType = event.doc._id ? event.doc._id.split('|')[0] : '';
				if (letChangedDocType != 'vin') {
					this.getDocsOfType('vin').then(async (wines: Array<VinModel>) => {
						wines
							.filter((wine) => {
								return wine[letChangedDocType]._id == event.doc._id;
							})
							.map((wine) => {
								debug('[execHooks]wine ' + JSON.stringify(wine));
								wine[letChangedDocType] = event.doc;
								winesToUpdate.push(wine);
							});
						debug('[execHooks]winesToUpdate length : ' + winesToUpdate.length);
						let promises = winesToUpdate.map((doc) => {
							this.db.put(doc);
						});
						let results = await Promise.all(promises);
						this.dbEvents$.next({ eventType: 'winesReadyToLoad' });
						debug('[execHooks]wines update result is : ' + JSON.stringify(results));
					});
				}
			});
		// perform post hooks
		// post Region save hook.
	}

	public put(id: string, document: any) {
		document._id = id;
		return this.getDoc(id).then(
			(result) => {
				document._rev = result._rev;
				return this.db.put(document);
			},
			(error) => {
				if (error.status == '404') {
					return this.db.put(document);
				} else {
					return new Promise((resolve, reject) => {
						reject(error);
					});
				}
			}
		);
	}

	// saveDoc will use a post command if the doc has no _id attribute, otherwize use the put to update the document
	// if a docClass is given and if the _id doesn't exist (this is a new document), the doc _id will be formed using the docClass
	// This will allow quick and easy retrival of doc types using only the doc's primary key (_id)
	// returns a promise or an the error object.
	public saveDoc(doc, docClass?) {
		let _self = this;
		let tmpDoc = doc;
		if (doc._id) {
			return this.db
				.get(doc._id)
				.then((resultDoc) => {
					// We are updating a document
					doc._rev = resultDoc._rev;
					return _self.db.put(doc);
				})
				.then((response) => {
					this.dbEvents$.next({ doc: doc, eventType: 'docUpdate' });
					return response;
				})
				.catch((err) => {
					if (err.status == 404) {
						// We are creating a new document
						return this.db
							.put(doc)
							.then((response) => {
								this.dbEvents$.next({
									doc: doc,
									eventType: 'docInsert'
								});
								return response;
							})
							.catch((err) => {
								console.error(err);
								return err;
							});
					} else {
						console.error(err);
						return err;
					}
				});
		} else {
			if (docClass) {
				// Create new document of type docClass
				doc._id = docClass + '|' + this.guid();
				return this.saveDoc(doc);
			} else {
				// Creates a new document without DocClass => using standard pouchDB doc._id
				return this.db
					.post(doc)
					.then((response) => {
						this.dbEvents$.next({ doc: doc, eventType: 'docInsert' });
						return response;
					})
					.catch((err) => {
						console.error(err);
						return err;
					});
			}
		}
	}

	public getDoc(id: string) {
		return this.db
			.get(id /* , { attachments: true } */)
			.then((result) => {
				return result;
			})
			.catch((error) => {
				console.error(error);
				return error;
			});
	}

	public deleteDoc(doc) {
		return this.db
			.remove(doc._id, doc._rev)
			.then((result) => {
				this.dbEvents$.next({ doc: doc, eventType: 'docDelete' });
				return result;
			})
			.catch((error) => {
				console.error(error);
				return error;
			});
	}

	public fetch(startKey?: string, endKey?: string) {
		if (startKey && endKey)
			return this.db.allDocs({ include_docs: true, startkey: startKey, endkey: endKey, inclusive_end: true });
		else return this.db.allDocs({ include_docs: true });
	}

	public getDocsOfType(type: string) {
		return this.db
			.allDocs({ include_docs: true, startkey: type + '|', endkey: type + '|\ufff0' })
			.then((result) => {
				if (result && result.rows) return result.rows.map((res) => res.doc);
				else return [];
			})
			.catch((error) => {
				debug('result error : ' + JSON.stringify(error));
				return error;
			});
	}

	public getDocsOfType$(type: string): Observable<any> {
		return from(
			this.db
				.allDocs({ include_docs: true, startkey: type + '|', endkey: type + '|\ufff0' })
				.then((result) => {
					if (result && result.rows) return result.rows.map((res) => res.doc);
					else return [];
				})
				.catch((error) => {
					debug('result error : ' + JSON.stringify(error));
					return error;
				})
		);
	}

	/**
     * Generates a GUID string.
     * @returns {String} The generated GUID.
     * @example af8a8416-6e18-a307-bd9c-f2c947bbb3aa
     * @author Slavik Meltser (slavik@meltser.info).
     * @link http://slavik.meltser.info/?p=142
     */
	private guid() {
		function _p8(s) {
			let p = (Math.random().toString(16) + '000000000').substr(2, 8);
			//        return s ? "-" + p.substr(0,4) + "-" + p.substr(4,4) : p ;
			// modified version to return 32 characters as a cloudant id
			return s ? p.substr(0, 4) + p.substr(4, 4) : p;
		}
		return _p8(false) + _p8(true) + _p8(true) + _p8(false);
	}
}
