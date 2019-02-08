import { TranslateService } from '@ngx-translate/core';
import { Component, OnInit, NgZone } from '@angular/core';
import { Location } from '@angular/common';
import { PouchdbService } from './../services/pouchdb.service';
import { AlertController, NavController, ModalController } from '@ionic/angular';

import * as Debugger from 'debug';
const debug = Debugger('app:preferences');

@Component({
	selector: 'app-preferences',
	templateUrl: './preferences.page.html',
	styleUrls: [ './preferences.page.scss' ]
})
export class PreferencesPage implements OnInit {
	public language: string = 'en';
	public remoteDBURL: string = '';
	public loading = false;
	public valid: boolean = false;
	public supportedLanguages: Map<string, string> = new Map([ [ 'fr', 'français' ], [ 'en', 'english' ] ]);
	/* [
		{ name: 'french', locale: 'fr-FR' },
		{ name: 'english', locale: 'en-US' }
	];
 */
	constructor(
		private location: Location,
		private dataService: PouchdbService,
		private alertCtrl: AlertController,
		private navCtrl: NavController,
		private zone: NgZone,
		private modalCtrl: ModalController,
		private translate: TranslateService
	) {}

	async confirmSync(header, message) {
		const alert = await this.alertCtrl.create({
			header: header,
			message: message,
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
		this.remoteDBURL = window.localStorage.getItem('myCellar.remoteDBURL');
		this.checkURLValidity();
		this.dataService.dbEvents$.subscribe((event) => {
			if (event.eventType == 'dbReplicationCompleted' || event.eventType == 'dbSynchronized') {
				debug('[ngOnInit] replication is finished');
				this.loading = false;
				this.confirmSync(
					this.translate.instant('config.syncOKHeader'),
					this.translate.instant('config.syncOKMessage')
				);
			}
			if (event.eventType == 'dbReplicationFailed' || event.eventType == 'dbSyncFailed') {
				debug('[ngOnInit] replication failed');
				this.loading = false;
				this.confirmSync(
					this.translate.instant('config.syncKOHeader'),
					this.translate.instant('config.syncKOMessage', { errorMessage: JSON.stringify(event.error) })
				);
			}
		});
		this.zone.run(() => (this.language = window.localStorage.getItem('myCellar.language')));
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
		window.localStorage.setItem('myCellar.remoteDBURL', this.remoteDBURL);
		this.dataService.syncLocalwithRemote();
	}

	replAndSyncWithRemoteDB() {
		debug('[PreferencesPage - replAndSyncWithRemoteDB] loading starts');
		this.loading = true;
		this.dataService.remote = this.remoteDBURL;
		window.localStorage.setItem('myCellar.remoteDBURL', this.remoteDBURL);
		this.dataService.replicateRemoteToLocal();
	}

	languageChange(val: any) {
		this.language = val.detail.value;
		debug('Language Change:', val);
		this.zone.run(() => this.translate.use(this.language));
		window.localStorage.setItem('myCellar.language', this.language);
	}

	async showSupportText() {
		const modal = await this.modalCtrl.create({
			component: SupportPage,
			backdropDismiss: true,
			showBackdrop: true
		});
		return await modal.present();
	}
}

@Component({
	template: `
			<ion-card>
				<ion-card-content>
					<p>{{'config.dbSettingExplain1' | translate}}</p>
					<p>{{'config.dbSettingExplain2' | translate}}</p>
					<ol>
						<li>{{'config.dbSettingExplain3' | translate}}</li>
						<li>{{'config.dbSettingExplain4' | translate}}</li>
					</ol>
				</ion-card-content>
			</ion-card>
			<ion-button expand="full" (click)="dismiss()">Close</ion-button>
			`
})
export class SupportPage {
	constructor(private modalCtrl: ModalController) {}

	dismiss() {
		this.modalCtrl.dismiss();
	}
}
