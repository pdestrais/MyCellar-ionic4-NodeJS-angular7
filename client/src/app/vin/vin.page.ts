import { Subject, fromEvent } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import {
	Component,
	OnInit,
	OnDestroy,
	AfterViewInit,
	Input,
	ElementRef,
	ViewChild,
	ChangeDetectorRef
} from '@angular/core';
import { NavController, NavParams, AlertController, ModalController, LoadingController } from '@ionic/angular';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PouchdbService } from '../services/pouchdb.service';
import { VinModel, AppellationModel, OrigineModel, TypeModel } from '../models/cellar.model';
import { HttpClient } from '@angular/common/http';
import moment from 'moment/src/moment';
import { map, debounceTime } from 'rxjs/operators';
import { ToastController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import loadImage from 'blueimp-load-image/js/index';
import pica from 'pica/dist/pica.js';
import { ViewerComponent } from './viewer/viewer.component';

import * as Debugger from 'debug';
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
	/* 	private canvasHeight: number = 200;
	private canvasWidth: number = 150;
	private mq420: MediaQueryList = window.matchMedia('(max-width: 420px)');
	private mq500: MediaQueryList = window.matchMedia('(min-width:421px) and (max-width: 500px )');
	private mq800: MediaQueryList = window.matchMedia('(min-width:501px) and (max-width: 800px )');
	private mq2000: MediaQueryList = window.matchMedia('(min-width:920px)');
 */
	private url: any;
	private imgRatio: number = 4 / 3;
	private imgMinWidth: number = 150;
	private imgMaxWidth: number = 550;
	private offScreenCanvas: HTMLCanvasElement = document.createElement('canvas');
	private selectedPhoto: { contentType: string; data: File } = {
		contentType: 'jpeg',
		data: new File([], 'Photo file')
	};

	/**
  * 'plug into' DOM canvas element using @ViewChild
  */
	@ViewChild('hiddenInput') hiddenInput: ElementRef;
	@ViewChild('photoImage') photoImage: any;
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
		private loadingCtrl: LoadingController
	) {
		this.vin = new VinModel(
			'',
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
			{ name: '', width: 0, heigth: 0, orientation: 1, fileType: '' }
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
		//this.canvas = this.canvasEl.nativeElement;
		this.canvas = document.createElement('canvas');
		//this.getCanvasDim();
		this.canvas.height = this.imgMinWidth * this.imgRatio;
		this.canvas.width = this.imgMinWidth;
		this.ctx = this.canvas.getContext('2d');
		// observable on window:resize event to handle photo image size resize. Prefered to HostListener because you can debounce with observables
		/* 		fromEvent(window, 'resize')
			.pipe(
				debounceTime(500),
				map(() => { return { height: window.innerHeight, width: window.innerWidth }; })
			)
			.subscribe(() => {
				this.canvas.width = Math.min(this.imgMaxWidth, this.getCanvasXSize());
				this.canvas.height = this.canvas.width * this.imgRatio;
				debug('resizing canvas to (W)' + this.canvas.width + ' (H)' + this.canvas.height);
				if (this.url) {
					let img = new Image();
					img.src = this.url;
					img.onload = (event: Event) => {
						this.ctx.drawImage(img,0,0,this.canvas.width,this.canvas.height);
					};
				}
			});
 */
		let paramId = this.route.snapshot.params['id'];

		// event emitted when appellations, origines & types are loaded
		this.obs.subscribe((message) => {
			if (paramId) {
				this.pouch.getDoc(paramId).then((vin) => {
					Object.assign(this.vin, vin);
					this.vinForm.setValue(
						this.reject(this.vin, [
							'_id',
							'_rev',
							'remarque',
							'history',
							'lastUpdated',
							'dateCreated',
							'cotes',
							'_attachments',
							'photo'
						])
					);
					this.vinForm.controls['appellation'].setValue(this.vin.appellation._id);
					this.vinForm.controls['origine'].setValue(this.vin.origine._id);
					this.vinForm.controls['type'].setValue(this.vin.type._id);
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
					{ name: '', width: 0, heigth: 0, orientation: 1, fileType: '' }
				);
			}
		});

		this.pouch.getDocsOfType('origine').then((result) => {
			this.origines = result;
			this.origines.sort((a, b) => {
				return a.pays + a.region < b.pays + b.region ? -1 : 1;
			});
			//debug('[VinPage constructor]origines is :' + JSON.stringify(this.origines));
			this.pouch.getDocsOfType('appellation').then((result) => {
				this.appellations = result;
				this.appellations.sort((a, b) => {
					return a.courte + a.longue < b.courte + b.longue ? -1 : 1;
				});
				//debug('[VinPage constructor]appellations is :' + JSON.stringify(this.appellations));
				this.pouch.getDocsOfType('type').then((result) => {
					this.types = result;
					this.types.sort((a, b) => {
						return a.nom < b.nom ? -1 : 1;
					});
					//debug('[VinPage constructor]types is :' + JSON.stringify(this.types));
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

	public async loadImageAndView(type: string) {
		let fileOrBlob: any;
		if (type == 'file') {
			let el = this.inputUploader.nativeElement;
			if (el) {
				fileOrBlob = el.files[0];
				this.selectedPhoto.data = fileOrBlob;
				this.vin.photo.name = fileOrBlob.name;
			}
		}
		if (type == 'blob' && this.selectedPhoto.data.size == 0) {
			try {
				fileOrBlob = await this.pouch.db.getAttachment(this.vin._id, 'photoFile');
			} catch (err) {
				debug('[loadImageAndView]no attachemnt to load - error :', err);
			}
		} else if (type == 'blob' && this.selectedPhoto.data.size != 0) {
			fileOrBlob = this.selectedPhoto.data;
		}

		this.modalCtrl
			.create({
				component: ViewerComponent,
				componentProps: {
					fileOrBlob: fileOrBlob,
					previewType: type == 'file' ? 'add' : 'modify'
				},
				cssClass: 'auto-height'
			})
			.then(async (modal) => {
				modal.present();
				const { data } = await modal.onDidDismiss();
				debug('[loadImageAndView]data from image preview modal : ' + JSON.stringify(data));
				switch (data.choice) {
					case 'delete':
						this.vin.photo = { name: '', width: 0, heigth: 0, orientation: 1, fileType: '' };
						this.selectedPhoto = {
							contentType: 'jpeg',
							data: new File([], 'Photo file')
						};
						try {
							let result = await this.pouch.db.removeAttachment(this.vin._id, 'photoFile', this.vin._rev);
						} catch (err) {
							debug('[loadImageAndView]problem to delete attachment - error : ', err);
						}
						break;
					case 'cancel':
						if (data.from == 'add') {
							this.selectedPhoto = {
								contentType: 'jpeg',
								data: new File([], 'Photo file')
							};
							this.vin.photo = { name: '', width: 0, heigth: 0, orientation: 1, fileType: '' };
						} else if (data.from == 'modify') {
							// Nothing to do
						}
						break;
					case 'replace':
						this.selectedPhoto = data.file;
						this.vin.photo.name = data.file.name;
						this.vin.photo.fileType = data.file.type;
					case 'keep':
						this.selectedPhoto.data = data.compressedBlob;
						this.selectedPhoto.contentType = data.selectedFile.type;
						this.vin.photo.name = data.selectedFile.name;
						this.vin.photo.fileType = data.selectedFile.type;
				}
			});
	}

	/* 	public async loadImageAndView_old(type: string) {
		let fileOrBlob: any;
		if (type == 'file') {
			let el = this.inputUploader.nativeElement;
			if (el) {
				fileOrBlob = el.files[0];
				this.selectedPhoto = fileOrBlob;
				this.vin.photo.fileType = fileOrBlob.type;
				this.vin.photo.name = fileOrBlob.name;
			}
		}
		if (type == 'blob' && this.selectedPhoto.size == 0) {
			try {
				fileOrBlob = await this.pouch.db.getAttachment(this.vin._id, 'photoFile');
			} catch (err) {
				debug('[loadImageAndView]no attachemnt to load - error :', err);
			}
		} else if (type == 'blob' && this.selectedPhoto.size != 0) {
			fileOrBlob = this.selectedPhoto;
		}
		let img = new Image();
		img.onload = () => {
			this.offScreenCanvas.width = img.width;
			this.offScreenCanvas.height = img.height;
			debug('[loadImageAndView]img.onload (x,y) : (' + img.width + ',' + img.height + ')');
			this.offScreenCanvas.getContext('2d').drawImage(img, 0, 0);
			this.modalCtrl
				.create({
					component: ViewerComponent,
					componentProps: {
						image: img,
						width: this.vin.photo.width,
						height: this.vin.photo.heigth,
						from: type == 'file' ? 'add' : 'modify'
					}
				})
				.then(async (modal) => {
					modal.present();
					const { data } = await modal.onDidDismiss();
					debug('[loadImageAndView]img.onload choice : ' + JSON.stringify(data));
					switch (data.choice) {
						case 'delete':
							this.vin.photo = null;
							try {
								var rev = '1-068E73F5B44FEC987B51354DFC772891';
								var result = await this.pouch.db.removeAttachment(
									this.vin._id,
									'photoFile',
									this.vin._rev
								);
							} catch (err) {
								debug('[loadImageAndView]problem to delete attachment - error : ', err);
							}
							break;
						case 'cancel':
							if (type == 'add') {
								this.selectedPhoto = null;
								this.vin.photo = { name: '', width: 0, heigth: 0, orientation: 1, fileType: '' };
							}
							break;
						case 'replace':
							this.selectedPhoto = data.file;
							this.vin.photo.name = data.file.name;
					}
				});
		};
		loadImage.parseMetaData(fileOrBlob, (data) => {
			var orientation = 0;
			if (typeof data.exif !== 'undefined') {
				orientation = parseInt(data.exif.get('Orientation'));
				let allTags = data.exif.getAll();
				this.imgRatio = allTags['PixelYDimension'] / allTags['PixelXDimension'];
				debug(
					'[showImage]orientation : ' +
						orientation +
						' - x: ' +
						allTags['PixelXDimension'] +
						' - y: ' +
						allTags['PixelYDimension']
				);
				this.vin.photo.width = allTags['PixelXDimension'];
				this.vin.photo.heigth = allTags['PixelYDimension'];
				this.vin.photo.orientation = orientation;
			}
			img.src = URL.createObjectURL(fileOrBlob);
		});
	}
 */

	/* 	public showImage() {
		this.canvas.width = Math.min(this.imgMaxWidth, this.getCanvasXSize());
		this.canvas.height = this.canvas.width * this.imgRatio;
		this.ctx = this.canvas.getContext('2d');
		let reader = new FileReader();
		let el = this.inputUploader.nativeElement;
		if (el) {
			let file = el.files[0];
			if (file && file.size != 0) {
				loadImage.parseMetaData(file, (data) => {
					var orientation = 0;
					if (typeof data.exif !== 'undefined') {
						orientation = parseInt(data.exif.get('Orientation'));
						let allTags = data.exif.getAll();
						this.imgRatio = allTags['PixelYDimension'] / allTags['PixelXDimension'];
						debug(
							'[showImage]orientation : ' +
								orientation +
								' - x: ' +
								allTags['PixelXDimension'] +
								' - y: ' +
								allTags['PixelYDimension']
						);
						this.vin.photo.width = allTags['PixelXDimension'];
						this.vin.photo.heigth = allTags['PixelYDimension'];
						this.vin.photo.orientation = orientation;
					}
					loadImage(
						file,
						(img) => {
							this.offScreenCanvas.width = img.width;
							this.offScreenCanvas.height = img.height;
							debug('[showImage]loadImage (x,y) : (' + img.width + ',' + img.height + ')');
							this.offScreenCanvas.getContext('2d').drawImage(img, 0, 0);
							//this.canvas.width = img.width;
							//this.canvas.heigth = img.height;
							this.ctx.drawImage(this.offScreenCanvas, 0, 0);
						}, // Options
						{
							minWidth: this.imgMinWidth,
							minHeight: this.imgMinWidth * this.imgRatio,
							maxWidth: this.imgMaxWidth,
							maxHeight: this.imgMaxWidth * this.imgRatio,
							orientation: orientation
						} // Options
					);
				});
				this.selectedPhoto = file;
				this.vin.photo.name = file.name;
			}
		}
	}
 */
	/* 	public showImageOnLoadWine(blob) {
		debug('[showImageOnLoadWine]image size is : ' + blob.size);
		loadImage.parseMetaData(blob, (data) => {
			if (typeof data.exif !== 'undefined') {
				let allTags = data.exif.getAll();
				this.imgRatio = allTags['PixelYDimension'] / allTags['PixelXDimension'];
			}
		});
		this.canvas.width = Math.min(this.imgMaxWidth, this.getCanvasXSize());
		this.canvas.height = this.canvas.width * this.imgRatio;
		if (!this.url) this.url = URL.createObjectURL(blob);
		let img = new Image();
		img.src = this.url;
		img.onload = (event: Event) => {
			this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
		};
	}
 */

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
			Object.assign(this.vin, this.vinForm.value);
			//this.vin = this.vinForm.value;
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
			if (this.selectedPhoto && this.selectedPhoto.data && this.selectedPhoto.data.size != 0) {
				if (this.selectedPhoto.contentType == 'image/jpeg') {
					//let blob: any = new Blob();
					/* 					pica
						.resize(this.offScreenCanvas, this.canvas, {
							unsharpAmount: 170,
							unsharpRadius: 0.6,
							unsharpThreshold: 5,
							quality: 3
						})
						.then(() => {
							debug('[ngOnInit] resize done !');
							//this.canvas.getContext('2d', { alpha: Boolean(alpha) }).drawImage(offScreenCanvas, 0, 0);
						});
 */
					//	this.offScreenCanvas.toBlob(quality:0.90)
					//blob = await this.canvasToBlob(this.offScreenCanvas, 0.8);
					debug('[saveVin]saved image file size : ' + this.selectedPhoto.data.size);
					this.vin['_attachments'] = {
						photoFile: {
							content_type: 'image/jpeg',
							data: this.selectedPhoto.data
						}
					};
				} else {
					this.vin['_attachments'] = {
						photoFile: {
							content_type: this.selectedPhoto.contentType,
							data: this.selectedPhoto.data
						}
					};
				}
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

	public async getGWSScore() {
		debug('[Vin.getGWSScore]called');
		const loading = await this.loadingCtrl.create({
			message: this.translate.instant('wine.fetchGWSSCore')
		});
		await loading.present();
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
			(GWscore: any) => {
				loading.dismiss();
				this.vinForm.patchValue({ GWSScore: GWscore.score });
				this.presentToast(this.translate.instant('wine.GWSScoreFound'), 'success', null);
			},
			(error) => {
				debug('http get error : ' + JSON.stringify(error.status));
				loading.dismiss();
				this.presentToast(
					this.translate.instant('wine.GWSScoreNotFound', {
						url:
							'https://www.globalwinescore.com/wine-score/' +
							this.cleanForUrl(this.vin.nom) +
							'-' +
							this.cleanForUrl(this.vin.origine.region) +
							'/' +
							this.vin.annee
					}),
					'error',
					null
				);
			}
		);
	}

	async presentLoading() {
		const loading = await this.loadingCtrl.create({
			message: 'getting GWS Score'
		});
		await loading.present();
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
		//debug('nodouble called');
		if (!group.controls.nom || !group.controls.annee) return null;
		if (!group.controls.nom.dirty || !group.controls.annee.dirty) return null;
		let testKey = group.value.nom + group.value.annee;
		if (this.vinsMap && this.vinsMap.has(testKey)) {
			debug('[Vin.noDouble]double detected');
			return { double: true };
		} else return null;
	}

	private async canvasToBlob(canvas, quality: number) {
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

	// Not used anymore - image canvas resizing is dynamic
	/* 	private getCanvasDim() {
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
			this.canvasWidth = 510;
			this.canvasHeight = 680;
			return;
		}
	}
 */
	private getCanvasXSize() {
		return (window.outerWidth - 100 - Math.floor(window.outerWidth / 990) * 270) * 8 / 12;
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
