import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { Component, OnInit, OnDestroy, AfterViewInit, Input, ElementRef, ViewChild, NgZone } from '@angular/core';
import { NavController, NavParams, AlertController, ModalController } from '@ionic/angular';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PouchdbService } from '../services/pouchdb.service';
import { VinModel, AppellationModel, OrigineModel, TypeModel } from '../models/cellar.model';
import { HttpClient } from '@angular/common/http';
import moment from 'moment/src/moment';
import { map } from 'rxjs/operators';
import { ToastController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
//import * as LoadImage from 'blueimp-load-image';
import loadImage from 'blueimp-load-image/js/index';

import * as Debugger from 'debug';
import { DomSanitizer } from '@angular/platform-browser';
const debug = Debugger('app:vin');

@Component({
	selector: 'app-vin',
	templateUrl: './vin.page.html',
	styleUrls: [ './vin.page.scss' ]
})
export class VinPage implements OnInit, OnDestroy, AfterViewInit {
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
	private ctx: any;
	private canvas: any;
	private canvasHeight: number = 200;
	private canvasWidth: number = 150;
	private url: string = '';
	public selectedImg: string = '';
	private mq420: MediaQueryList = window.matchMedia('(max-width: 420px)');
	private mq500: MediaQueryList = window.matchMedia('(min-width:421px) and (max-width: 500px )');
	private mq800: MediaQueryList = window.matchMedia('(min-width:501px) and (max-width: 800px )');
	private mq2000: MediaQueryList = window.matchMedia('(min-width:801px)');
	public testObject = {};

	/**
  * 'plug into' DOM canvas element using @ViewChild
  */
	@ViewChild('canvas') canvasEl: ElementRef;
	@ViewChild('ionInputElRef', { read: ElementRef })
	ionInputElRef: ElementRef;
	@ViewChild('photoImage') photoImage: ElementRef<HTMLImageElement>;
	@ViewChild('uploadphoto') inputUploader: ElementRef<HTMLInputElement>;

	constructor(
		private route: ActivatedRoute,
		private navCtrl: NavController,
		private pouch: PouchdbService,
		private formBuilder: FormBuilder,
		private translate: TranslateService,
		private alertController: AlertController,
		private modalCtrl: ModalController,
		private http: HttpClient,
		private toastCtrl: ToastController,
		private zone: NgZone
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
			[],
			new File([], 'no file')
		);
		this.pouch
			.getDocsOfType('vin')
			.then((vins) => (this.vinsMap = new Map(vins.map((v) => [ v.nom + v.annee, v ]))));
		/* 		this.nameYearForm = this.formBuilder.group(
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
 */ this.vinForm = this.formBuilder.group(
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
				],
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
				apogee: [ '', Validators.pattern('^[0-9]{4,4}-[0-9]{4,4}$') ],
				contenance: [ '' ],
				cepage: [ '' ],
				GWSScore: [ '' ]
			},
			{ validator: this.noDouble.bind(this) }
		);
		this.submitted = false;
	}

	public ngOnInit() {
		debug('[Vin.ngOnInit]called');
		/* 		this.inputUploader.nativeElement.onchange((event: any) => {
			this.showImage();
			return '';
		});
 */
		// Setting canvas for wine image display - no listeners are defined as the resolution is not expected to change during usage
		this.canvas = this.canvasEl.nativeElement;
		this.getCanvasDim();
		this.canvas.height = this.canvasHeight;
		this.canvas.width = this.canvasWidth;
		this.ctx = this.canvas.getContext('2d');
		let paramId = this.route.snapshot.params['id'];

		// event emitted when appellations, origines & types are loaded
		this.obs.subscribe((message) => {
			if (paramId) {
				this.pouch.getDoc(paramId).then((vin) => {
					Object.assign(this.vin, vin);
					//this.vin.appellation = this.vin.appellation._id;
					this.vinForm.setValue(
						this.reject(vin, [
							'_id',
							'_rev',
							'remarque',
							'history',
							'lastUpdated',
							'dateCreated',
							'cotes',
							'_attachments'
						])
					);
					this.vinForm.controls['appellation'].setValue(this.vin.appellation._id);
					this.vinForm.controls['origine'].setValue(this.vin.origine._id);
					this.vinForm.controls['type'].setValue(this.vin.type._id);
					// Processing attachment and adjusting rendering canvas size to minimize real estate used by photo in case it doesn't exist.
					if (this.vin['_attachments']) {
						this.selectedImg = 'current Photo';
						this.pouch.db
							.getAttachment(this.vin._id, 'photoFile')
							.then((blob) => this.showImageOnLoadWine(blob))
							.catch(function(err) {
								debug('[ngOnInit load attachment]Error : ' + err);
							});
					} else {
						this.canvas = this.canvasEl.nativeElement;
						this.canvas.height = 0;
						this.canvas.width = 0;
					}
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
					[],
					new File([], 'no file')
				);
			}
		});

		this.pouch.getDocsOfType('origine').then((result) => {
			this.origines = result;
			this.origines.sort((a, b) => {
				return a.pays + a.region < b.pays + b.region ? -1 : 1;
			});
			debug('[VinPage constructor]origines is :' + JSON.stringify(this.origines));
			this.pouch.getDocsOfType('appellation').then((result) => {
				this.appellations = result;
				this.appellations.sort((a, b) => {
					return a.courte + a.longue < b.courte + b.longue ? -1 : 1;
				});
				debug('[VinPage constructor]appellations is :' + JSON.stringify(this.appellations));
				this.pouch.getDocsOfType('type').then((result) => {
					this.types = result;
					this.types.sort((a, b) => {
						return a.nom < b.nom ? -1 : 1;
					});
					debug('[VinPage constructor]types is :' + JSON.stringify(this.types));
					window.setTimeout(() => {
						this.obs.next('typeLoaded');
					}, 200);
				});
			});
		});
	}

	public ngAfterViewInit() {
		debug('[entering ngAfterViewInit]');
	}

	public showImage() {
		this.getCanvasDim();
		this.canvas.height = this.canvasHeight;
		this.canvas.width = this.canvasWidth;
		this.ctx = this.canvas.getContext('2d');
		let reader = new FileReader();
		//let el = this.ionInputElRef.nativeElement.shadowRoot.querySelector('input') as HTMLInputElement;
		let el = this.inputUploader.nativeElement;
		if (el) {
			let file = el.files[0];
			if (file && file.size != 0) {
				loadImage.parseMetaData(file, (data) => {
					var orientation = 0;
					if (typeof data.exif !== 'undefined') {
						orientation = parseInt(data.exif.get('Orientation'));
					}
					loadImage(
						file,
						(img) => {
							this.ctx.drawImage(img, 0, 0, this.canvasWidth, this.canvasHeight);
						},
						{ maxWidth: this.canvasWidth, maxHeight: this.canvasHeight, orientation: orientation } // Options
					);
				});
				this.vin.photo = file;
				this.selectedImg = file.name;
				/* 				var img: HTMLImageElement = new Image();
				img.onload = () => {
					// draw image
					this.ctx.drawImage(img, 0, 0, this.canvasWidth, this.canvasHeight);
				};
				// this is to setup loading the image
				reader.onloadend = () => {
					img.src = reader.result as string;
				};
				// this is to read the file
				reader.readAsDataURL(file);
 */
			}
		}
	}

	public showImageOnLoadWine(blob) {
		var url = URL.createObjectURL(blob);
		let img = new Image();
		img.src = url;
		img.onload = (event: Event) => {
			this.ctx.drawImage(img, 0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
		};
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

	public async saveVin() {
		debug('[Vin.saveVin]entering');
		this.submitted = true;
		if (this.vinForm.valid) {
			// validation succeeded
			debug('[Vin.saveVin]vin valid');
			let id = this.vin._id;
			this.vin = this.vinForm.value;
			this.vin._id = id;
			this.vin.lastUpdated = new Date().toISOString();
			this.vin.appellation = this.appellations.find((appellation) => appellation._id == this.vin.appellation);
			this.vin.origine = this.origines.find((origine) => origine._id == this.vin.origine);
			this.vin.type = this.types.find((type) => type._id == this.vin.type);
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
			if (this.vin.photo && this.vin.photo.size != 0) {
				let fileName = this.vin.photo['name'];
				if (this.vin.photo.type == 'image/jpeg') {
					let blob = await this.canvasToBlob(this.canvas, 0.85);
					this.vin['_attachments'] = {
						photoFile: {
							content_type: 'image/jpeg',
							data: blob
						}
					};
				} else {
					this.vin['_attachments'] = {
						photoFile: {
							content_type: this.vin.photo.type,
							data: this.vin.photo
						}
					};
				}
				delete this.vin.photo;
			}
			this.pouch.saveDoc(this.vin, 'vin').then((response) => {
				if (response.ok) {
					debug('[Vin.saveVin]vin ' + JSON.stringify(this.vin) + ' saved');
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
		if (typeof val.detail.value == 'string')
			this.pouch
				.getDoc(val.detail.value)
				.then((result) => (this.vin.type = new TypeModel(result._id, result.nom)));
	}

	public origineChange(val: any) {
		debug('origine change detected');
		if (typeof val.detail.value == 'string')
			this.pouch
				.getDoc(val.detail.value)
				.then((result) => (this.vin.origine = new OrigineModel(result._id, result.pays, result.region)));
	}

	public appellationChange(val: any) {
		debug('appellation change detected');
		if (typeof val.detail.value == 'string')
			this.pouch
				.getDoc(val.detail.value)
				.then(
					(result) => (this.vin.appellation = new AppellationModel(result._id, result.courte, result.longue))
				);
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

	private canvasToBlob(canvas, quality: number) {
		return new Promise(function(resolve) {
			canvas.toBlob(
				function(blob) {
					return resolve(blob);
				},
				'image/jpeg',
				quality
			);
		});
	}

	private getCanvasDim() {
		if (this.mq420.matches) {
			this.canvasWidth = 150;
			this.canvasHeight = 180;
			return;
		}
		if (this.mq500.matches) {
			this.canvasWidth = 210;
			this.canvasHeight = 280;
			return;
		}
		if (this.mq800.matches) {
			this.canvasWidth = 300;
			this.canvasHeight = 400;
			return;
		}
		if (this.mq2000.matches) {
			this.canvasWidth = 600;
			this.canvasHeight = 800;
			return;
		}
	}

	private reject(obj, keys) {
		return Object.keys(obj)
			.filter((k) => !keys.includes(k))
			.map((k) => Object.assign({}, { [k]: obj[k] }))
			.reduce((res, o) => Object.assign(res, o), {});
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
