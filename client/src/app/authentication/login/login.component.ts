import { PouchdbService } from './../../services/pouchdb.service';
import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { first } from 'rxjs/operators';

import { AuthenticationService } from '../../services/auth.service';
import { ToastController, LoadingController } from '@ionic/angular';

import * as Debugger from 'debug';
import { TranslateService } from '@ngx-translate/core';
const debug = Debugger('app:login');

const CLOUDANTDBURL =
	'https://d9b71086-9d4d-45ed-b6f8-42ffbfcbec84-bluemix:eadc2fb095f724f11fbb3c523694d1bef8b8e09a8d88d8c15891d37c13eb90ec@d9b71086-9d4d-45ed-b6f8-42ffbfcbec84-bluemix.cloudant.com/';

@Component({ templateUrl: 'login.component.html', styleUrls: [ 'login.component.scss' ] })
export class LoginComponent implements OnInit {
	loginForm: FormGroup;
	loading = false;
	submitted = false;
	returnUrl: string;
	loadingOverlay: HTMLIonLoadingElement;

	constructor(
		private formBuilder: FormBuilder,
		private route: ActivatedRoute,
		private router: Router,
		private authenticationService: AuthenticationService,
		private toastCtrl: ToastController,
		private translate: TranslateService,
		private loadingCtrl: LoadingController,
		private dataService: PouchdbService
	) {
		// redirect to home if already logged in
		if (this.authenticationService.currentUserValue) {
			this.router.navigate([ '/' ]);
		}
	}

	ngOnInit() {
		debug('[ngOnInit]Entering');
		this.loginForm = this.formBuilder.group({
			username: [ '', Validators.required ],
			password: [ '', Validators.required ]
		});
		this.loginForm.reset();

		// get return url from route parameters or default to '/'
		this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
	}

	// convenience getter for easy access to form fields
	get f() {
		return this.loginForm.controls;
	}

	onSubmit() {
		this.submitted = true;

		// stop here if form is invalid
		if (this.loginForm.invalid) {
			return;
		}

		this.loading = true;
		this.authenticationService.login(this.f.username.value, this.f.password.value).pipe(first()).subscribe(
			(data) => {
				if (data.message) {
					this.presentToast(
						this.translate.instant('login.failed') +
							' : ' +
							this.translate.instant('login.' + data.translateKey),
						'danger',
						null
					);
				} else {
					debug('[onSubmit]user just logged in - returning to ' + this.returnUrl + ' after login');
					let previousUser = JSON.parse(localStorage.getItem('previousUser')) || { username: '' };
					if (data.username != previousUser.username) {
						debug(
							'[onSubmit] reloading local database from : ' + CLOUDANTDBURL + 'cellar$' + data.username
						);
						this.loadingCtrl.create({ message: 'loading database' }).then((overlay) => {
							this.loadingOverlay = overlay;
							this.loadingOverlay.present();
						});
						let subscription = this.dataService.dbEvents$.subscribe((event) => {
							if (event.eventType == 'dbReplicationCompleted' || event.eventType == 'dbSynchronized') {
								debug('[ngOnInit] replication is finished');
								this.loadingOverlay.dismiss();
								this.presentToast(this.translate.instant('config.syncOKMessage'), 'success', null);
								this.router.navigate([ this.returnUrl ]);
								subscription.unsubscribe();
							}
							if (event.eventType == 'dbReplicationFailed' || event.eventType == 'dbSyncFailed') {
								debug('[ngOnInit] replication failed');
								this.presentToast(
									this.translate.instant('config.syncKOMessage', {
										errorMessage: JSON.stringify(event.error)
									}),
									'danger',
									null
								);
								subscription.unsubscribe();
							}
						});
						this.dataService.remote = CLOUDANTDBURL + 'cellar$' + data.username;
						localStorage.setItem('myCellar.remoteDBURL', this.dataService.remote);
						this.dataService.replicateRemoteToLocal();
					}
				}
			},
			(error) => {
				this.presentToast(this.translate.instant('login.failed') + ' : ' + error.message, 'danger', null);
				this.loading = false;
			}
		);
	}

	async presentToast(message: string, type: string, nextPageUrl: string) {
		const toast = await this.toastCtrl.create({
			color: type == 'success' ? 'secondary' : 'danger',
			message: message,
			duration: 2000
		});
		toast.present();
		if (nextPageUrl) this.router.navigate([ nextPageUrl ]);
	}
}
