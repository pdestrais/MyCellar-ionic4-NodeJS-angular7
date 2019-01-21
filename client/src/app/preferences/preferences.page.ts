import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { PouchdbService } from './../services/pouchdb.service';
import { AlertController, NavController } from '@ionic/angular';

import * as Debugger from 'debug';
const debug = Debugger('app:preferences');

@Component({
	selector: 'app-preferences',
	templateUrl: './preferences.page.html',
	styleUrls: [ './preferences.page.scss' ]
})
export class PreferencesPage implements OnInit {
	public remoteDBURL: string = '';
	public loading = false;
	public valid: boolean = false;

	constructor(
		private location: Location,
		private dataService: PouchdbService,
		private alertCtrl: AlertController,
		private navCtrl: NavController
	) {}

	async confirmSync() {
		const alert = await this.alertCtrl.create({
			header: 'Synchronization done',
			message:
				'Your local database in now synchronized with the remote cloudant database. All changes will now be replicated and available on all your devices.',
			buttons: [
				{
					text: 'Ok',
					handler: () => {
						this.navCtrl.navigateBack('/home');
					}
				}
			]
		});
		await alert.present();
	}

	ngOnInit() {
		debug('[ngOnInit]');
		this.remoteDBURL = window.localStorage.getItem('remoteDBURL');
		this.checkURLValidity();
		this.dataService.dbEvents$.subscribe((event) => {
			if (event.eventType == 'dbReplicationCompleted' || event.eventType == 'dbSynchronized') {
				debug('[ngOnInit] replication is finished');
				this.loading = false;
				this.confirmSync();
			}
		});
	}

	goBack() {
		this.location.back();
	}

	checkURLValidity() {
		let urlRegExp = new RegExp(/^(https?:\/\/)?([\da-z\.-]+)\:([\da-z\.-]+)\@([\da-z\.-]+)\/([\da-z\.-]+)$/);
		//([a-z\.]{2,6})([\/\w \.-]*)*\/?$/);
		if (this.remoteDBURL) this.valid = urlRegExp.test(this.remoteDBURL);
		this.valid = true;
	}

	syncWithRemoteDB() {
		debug('[PreferencesPage - syncWithRemoteDB] loading starts');
		this.loading = true;
		this.dataService.remote = this.remoteDBURL;
		window.localStorage.setItem('remoteDBURL', this.remoteDBURL);
		this.dataService.syncLocalwithRemote();
	}

	replAndSyncWithRemoteDB() {
		debug('[PreferencesPage - replAndSyncWithRemoteDB] loading starts');
		this.loading = true;
		this.dataService.remote = this.remoteDBURL;
		window.localStorage.setItem('remoteDBURL', this.remoteDBURL);
		this.dataService.replicateRemoteToLocal();
	}
}
