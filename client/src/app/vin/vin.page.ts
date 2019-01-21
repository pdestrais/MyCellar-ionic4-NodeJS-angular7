import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { NavController, NavParams, AlertController, ModalController } from '@ionic/angular';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PouchdbService } from '../services/pouchdb.service';
import { VinModel, AppellationModel, OrigineModel, TypeModel } from '../models/cellar.model';
import { HttpClient } from '@angular/common/http';
import moment from 'moment/src/moment';
import { map } from 'rxjs/operators';
import { ToastController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';

import * as Debugger from 'debug';
const debug = Debugger('app:vin');

@Component({
	selector: 'app-vin',
	templateUrl: './vin.page.html',
	styleUrls: [ './vin.page.scss' ]
})
export class VinPage implements OnInit, OnDestroy {
	public nbreAvantUpdate: number = 0;
	public newWine: boolean = true;
	public vin: VinModel;
	public vinsMap: Map<any, object>;
	public origines: Array<any> = [];
	public appellations: Array<any> = [];
	public types: Array<any> = [];
	public comment: string = '';
	public errors: Array<any>;
	public vinForm: FormGroup;
	public nameYearForm: FormGroup;
	public submitted: boolean;
	private obs: Subject<string> = new Subject();
	public priceRegExp: RegExp = new RegExp('^[0-9]+(,[0-9]{1,2})?$');

	constructor(
		private route: ActivatedRoute,
		private navCtrl: NavController,
		private pouch: PouchdbService,
		private formBuilder: FormBuilder,
		private translate: TranslateService,
		private alertController: AlertController,
		private modalCtrl: ModalController,
		private http: HttpClient,
		private toastCtrl: ToastController
	) {
		this.vin = new VinModel(
			'',
			'',
			'',
			0,
			0,
			0,
			'',
			'',
			'',
			'',
			[],
			'',
			new AppellationModel('', '', ''),
			new OrigineModel('', '', ''),
			new TypeModel('', ''),
			'',
			'',
			0,
			[]
		);
		this.pouch
			.getDocsOfType('vin')
			.then((vins) => (this.vinsMap = new Map(vins.map((v) => [ v.nom + v.annee, v ]))));
		this.nameYearForm = this.formBuilder.group(
			{
				nom: [ '', Validators.required ],
				annee: [
					'',
					Validators.compose([
						Validators.minLength(4),
						Validators.maxLength(4),
						Validators.pattern('[0-9]*'),
						Validators.required
					])
				]
			},
			{ validator: this.noDouble.bind(this) }
		);
		this.vinForm = this.formBuilder.group({
			nameYearForm: this.nameYearForm,
			type: [ '', Validators.required ],
			origine: [ '', Validators.required ],
			appellation: [ '', Validators.required ],
			nbreBouteillesAchat: [ 0, Validators.required ],
			nbreBouteillesReste: [ 0, Validators.compose([ Validators.pattern('[0-9]*'), Validators.required ]) ],
			prixAchat: [
				0,
				Validators.compose([
					Validators.pattern('^[0-9]+((,[0-9]{1,2})|(.[0-9]{1,2}))?$'),
					Validators.required
				])
			],
			//        prixAchat: [0,Validators.required],
			dateAchat: [ '', Validators.required ],
			localisation: [ '', Validators.required ],
			apogee: [ '', Validators.pattern('^[0-9]{4,4}-[0-9]{4,4}$') ]
		});
		this.submitted = false;
	}

	public ngOnInit() {
		debug('[Vin.ngOnInit]called');
		let paramId = this.route.snapshot.params['id'];
		// event emitted when appellations, origines & types are loaded
		this.obs.subscribe((message) => {
			if (paramId) {
				this.pouch.getDoc(paramId).then((vin) => {
					debug('vin ' + JSON.stringify(vin));
					Object.assign(this.vin, vin);
					this.nbreAvantUpdate = this.vin.nbreBouteillesReste;
					this.newWine = false;
					debug('[Vin.ngOnInit]Vin loaded : ' + JSON.stringify(this.vin));
				});
			} else {
				let now = moment();
				// Search for type that correspond to "red" and use it's _id to initialize the vin attribute
				let preselectedType;
				if (this.types && this.types.length > 0) {
					preselectedType = this.types.find((e) => {
						return e.nom == 'Rouge' || e.nom == 'Red';
					});
				}
				this.vin = new VinModel(
					'',
					'',
					'',
					0,
					0,
					0,
					now.format('YYYY-MM-DD'),
					'',
					'',
					'',
					[],
					'',
					new AppellationModel('', '', ''),
					new OrigineModel('', '', ''),
					new TypeModel(
						preselectedType ? preselectedType._id : '',
						preselectedType ? preselectedType.nom : ''
					),
					'',
					'',
					0,
					[]
				);
			}
		});

		this.pouch.getDocsOfType('origine').then((result) => {
			this.origines = result;
			this.origines.sort((a, b) => {
				return a.pays + a.region < b.pays + b.region ? -1 : 1;
			});
			//debug('[VinPage constructor]origines is :'+JSON.stringify(this.origines));
			this.pouch.getDocsOfType('appellation').then((result) => {
				this.appellations = result;
				this.appellations.sort((a, b) => {
					return a.courte + a.longue < b.courte + b.longue ? -1 : 1;
				});
				//debug('[VinPage constructor]appellations is :'+JSON.stringify(this.appellations));
				this.pouch.getDocsOfType('type').then((result) => {
					this.types = result;
					this.types.sort((a, b) => {
						return a.nom < b.nom ? -1 : 1;
					});
					//debug('[VinPage constructor]types is :'+JSON.stringify(this.types));
					this.obs.next('typeLoaded');
				});
			});
		});
	}

	public ngOnDestroy() {
		debug('[Vin.ngOnDestroy]called');
		this.obs.unsubscribe();
	}

	public ionViewWillEnter() {
		debug('[Vin.ionViewWillEnter]called');
	}

	public ionViewDidLoad() {
		debug('[Vin.ionViewDidLoad]called');
	}

	public saveVin() {
		debug('[Vin.saveVin]entering');
		this.submitted = true;
		if (this.vinForm.valid) {
			// validation succeeded
			debug('[Vin.saveVin]vin valid');
			this.vin.lastUpdated = new Date().toISOString();
			if (this.newWine) {
				this.vin.history.push({
					type: 'creation',
					difference: this.vin.nbreBouteillesReste,
					date: this.vin.lastUpdated,
					comment: ''
				});
			} else {
				if (this.vin.nbreBouteillesReste - this.nbreAvantUpdate != 0)
					this.vin.history.push({
						type: 'update',
						difference: this.vin.nbreBouteillesReste - this.nbreAvantUpdate,
						date: this.vin.lastUpdated,
						comment: ''
					});
			}
			if (this.vin.remarque && this.vin.remarque != '') {
				this.vin.history.push({
					type: 'comment',
					date: this.vin.lastUpdated,
					comment: this.vin.remarque,
					difference: 0
				});
				this.vin.remarque = '';
			}
			this.pouch.saveDoc(this.vin, 'vin').then((response) => {
				if (response.ok) {
					debug('[Vin.saveVin]vin ' + JSON.stringify(this.vin) + 'saved');
					this.presentToast(this.translate.instant('general.dataSaved'), 'success', '/home');
					//this.navCtrl.push(SearchPage)
				} else {
					this.presentToast(this.translate.instant('general.DBError'), 'error', '/home');
				}
			});
		} else {
			debug('[Vin.saveVin]vin invalid');
			this.presentToast(this.translate.instant('general.invalidData'), 'error', null);
		}
	}

	deleteVin() {
		this.alertController
			.create({
				header: this.translate.instant('general.confirm'),
				message: this.translate.instant('general.sure'),
				buttons: [
					{
						text: this.translate.instant('general.cancel')
					},
					{
						text: this.translate.instant('general.ok'),
						handler: () => {
							this.pouch.db.deleteDoc(this.vin).then((response) => {
								if (response.ok) {
									this.presentToast(this.translate.instant('wine.wineDeleted'), 'success', '/home');
								} else {
									this.presentToast(
										this.translate.instant('wine.wineNotDeleted'),
										'error',
										undefined
									);
								}
							});
						}
					}
				]
			})
			.then((alert) => {
				alert.present();
			});
	}

	public cancel() {
		this.navCtrl.goBack();
	}

	public showHistory() {
		this.modalCtrl.create({ component: ModalPage, componentProps: { vin: this.vin } }).then((modal) => {
			modal.present();
		});
	}

	async presentToast(message: string, type: string, nextPageUrl: string) {
		const toast = await this.toastCtrl.create({
			color: type == 'success' ? 'secondary' : 'danger',
			message: message,
			duration: 2000
		});
		toast.present();
		if (nextPageUrl) this.navCtrl.navigateRoot(nextPageUrl);
	}

	addComment() {
		this.alertController
			.create({
				header: this.translate.instant('wine.addComment'),
				//message: 'What should the title of this note be?',
				inputs: [
					{
						type: 'text',
						name: 'comment'
					}
				],
				buttons: [
					{
						text: 'Cancel'
					},
					{
						text: 'Save',
						handler: (data) => {
							debug('add comment data : ' + data);
							this.vin.remarque = data.comment;
							debug('add comment - save vin');
							this.saveVin();
						}
					}
				]
			})
			.then((alert) => {
				alert.present();
			});
	}

	public typeChange(val: any) {
		debug('type change detected');
		this.pouch.getDoc(val.detail.value).then((result) => (this.vin.type = new TypeModel(result._id, result.nom)));
	}

	public origineChange(val: any) {
		debug('origine change detected');
		this.pouch
			.getDoc(val.detail.value)
			.then((result) => (this.vin.origine = new OrigineModel(result._id, result.pays, result.region)));
	}

	public appellationChange(val: any) {
		debug('appellation change detected');
		this.pouch
			.getDoc(val.detail.value)
			.then((result) => (this.vin.appellation = new AppellationModel(result._id, result.courte, result.longue)));
	}

	public showDate(ISODateString) {
		return ISODateString.substring(0, 10);
	}

	public toNumber(attribute: string) {
		if (typeof this.vin[attribute] === 'string') {
			this.vin[attribute] = this.vin[attribute].replace(',', '.');
			this.vin[attribute] = parseFloat(this.vin[attribute]);
		}
		debug('[Vin.toNumber]' + attribute + ' changed: ' + this.vin[attribute]);
	}

	public getGWSScore() {
		debug('[Vin.getGWSScore]called');
		//        if (platforms.indexOf("core")!=-1) {
		// Create url
		let prefix = window.location.origin + '/api/';
		let url =
			prefix +
			'GWS/' +
			this.cleanForUrl(this.vin.origine.region) +
			'/' +
			this.cleanForUrl(this.vin.nom) +
			'/' +
			this.vin.annee;
		debug('[Vin.getGWSScore]url :' + url);
		this.http.get(url).subscribe(
			(GWSScore: any) => {
				this.vin.GWSScore = GWSScore.score;
			},
			(error) => {
				debug('http get error : ' + JSON.stringify(error.status));
			}
		);
	}

	private cleanForUrl(text: string) {
		return text
			.trim()
			.toLowerCase()
			.replace(/ /g, '-')
			.replace(/'/g, '')
			.replace(/â/g, 'a')
			.replace(/é/g, 'e')
			.replace(/è/g, 'e')
			.replace(/ê/g, 'e')
			.replace(/û/g, 'u')
			.replace(/ô/g, 'o')
			.replace(/î/g, 'i');
	}

	private noDouble(group: FormGroup) {
		debug('nodouble called');
		if (!group.controls.nom || !group.controls.annee) return null;
		if (!group.controls.nom.dirty || !group.controls.annee.dirty) return null;
		let testKey = group.value.nom + group.value.annee;
		if (this.vinsMap && this.vinsMap.has(testKey)) {
			debug('[Vin.noDouble]double detected');
			return { double: true };
		} else return null;
	}
}

@Component({
	template: `
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-menu-button></ion-menu-button>
      </ion-buttons>
      <ion-title>
        {{'wine.history' | translate }}
      </ion-title>
    </ion-toolbar>
  </ion-header>
  <ion-content>
    <ion-card *ngFor="let event of vin.history">
        <ion-card-header >
            <div *ngIf="event.difference && event.difference!=0">
                {{'wine.addedExtractedOn' | translate }} : &nbsp; {{event.date}}  
            </div>
            <div *ngIf="event.comment">
                {{'wine.addedOn' | translate }} : &nbsp; {{event.date}}
            </div>
        </ion-card-header>
        <ion-card-content>
            <div *ngIf="event.difference && event.difference!=0">
                {{'wine.difference' | translate }} :&nbsp; <ion-badge item-end>{{event.difference}}</ion-badge>    
            </div>
            <div *ngIf="event.comment">
                {{'wine.comment' | translate }} : &nbsp; {{event.comment}}
            </div>
        </ion-card-content>
    </ion-card>
    <ion-button expand="full" (click)="dismiss()">Close</ion-button>
  </ion-content>
  `
})
export class ModalPage {
	@Input() vin: VinModel;

	constructor(private modalCtrl: ModalController) {}
	dismiss() {
		this.modalCtrl.dismiss();
	}
}
