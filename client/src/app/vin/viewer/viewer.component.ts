import { Component, OnInit, Input, ElementRef, ViewChild } from '@angular/core';
import { ModalController } from '@ionic/angular';
import loadImage from 'blueimp-load-image/js/index';
import Pica from 'pica/dist/pica.js';
import * as Debugger from 'debug';
const debug = Debugger('app:vin:viewer');

const pica = Pica();
const quality = 1;
const viewerCanvasWidth: number = 320;
const viewerCanvasHeight: number = 426;

@Component({
	selector: 'app-viewer',
	templateUrl: './viewer.component.html',
	styleUrls: [ './viewer.component.scss' ]
})
export class ViewerComponent implements OnInit {
	@Input() fileOrBlob: any; // image is a File or Blob
	@Input() previewType: string;
	@ViewChild('selectedPhoto') canvasEl: ElementRef;
	@ViewChild('canvasContainer') canvasCntnr: any;
	@ViewChild('uploadphoto') inputUploader: ElementRef<HTMLInputElement>;

	private from: string;
	private imgRatio: number;
	private selectedFile: File;

	private canvas: HTMLCanvasElement;

	constructor(private modalCtrl: ModalController) {}

	async dismiss(choice: string) {
		let compressedBlob: Blob;
		let compressedBlobWithExif: Blob;
		if (choice == 'keep' && this.previewType == 'add') {
			compressedBlob = await pica.toBlob(this.canvas, 'image/jpeg', quality);
			debug('[dismiss]compressedBlob size : ' + compressedBlob.size);
			loadImage.parseMetaData(
				this.selectedFile,
				(data) => {
					if (!data.imageHead) {
						return;
					}
					// Combine data.imageHead with the image body of a resized file
					// to create scaled images with the original image meta data, e.g.:
					compressedBlobWithExif = new Blob(
						[
							data.imageHead,
							// Resized images always have a head size of 20 bytes,
							// including the JPEG marker and a minimal JFIF header:
							loadImage.blobSlice.call(compressedBlob, 20)
						],
						{ type: 'image/jpeg' }
					);
					debug('[dismiss]compressedBlobWithExif : ' + compressedBlobWithExif.size);
					this.modalCtrl.dismiss({
						choice: choice,
						compressedBlob: compressedBlobWithExif,
						from: this.from,
						selectedFile: this.selectedFile
					});
				},
				{
					maxMetaDataSize: 262144,
					disableImageHead: false
				}
			);
		} else {
			this.modalCtrl.dismiss({
				choice: choice,
				compressedBlob: compressedBlobWithExif,
				from: this.from,
				selectedFile: this.selectedFile
			});
		}
		//debug('[dismiss]compressedBlobWithExif size : ' + compressedBlobWithExif.size);
	}

	ngOnInit() {
		debug('[ngOnInit]File or Blob size : ' + this.fileOrBlob.size);
		this.from = this.previewType;
		// if fileOrBlob is a File
		if (this.fileOrBlob.name) {
			this.selectedFile = this.fileOrBlob;
		}
		//		let offScreenCanvas = document.createElement('canvas');
		//		offScreenCanvas.width = this.canvas.width;
		//		offScreenCanvas.height = this.canvas.width;
		loadImage.parseMetaData(this.fileOrBlob, (data) => {
			let img = new Image();
			let exifWidth = 0;
			let exifHeigth = 0;
			let exifOrientation = 1;
			if (typeof data.exif !== 'undefined') {
				exifOrientation = parseInt(data.exif.get('Orientation'));
				let allTags = data.exif.getAll();
				this.imgRatio = allTags['PixelYDimension'] / allTags['PixelXDimension'];
				debug(
					'[showImage]orientation : ' +
						exifOrientation +
						' - x: ' +
						allTags['PixelXDimension'] +
						' - y: ' +
						allTags['PixelYDimension']
				);
				exifWidth = allTags['PixelXDimension'];
				exifHeigth = allTags['PixelYDimension'];
				this.canvas = this.canvasEl.nativeElement;
				this.canvas.width = viewerCanvasWidth; //window.innerWidth - 40;
				this.canvas.height = viewerCanvasHeight; //this.canvas.width / exifWidth * exifHeigth;
				img.src = URL.createObjectURL(this.fileOrBlob);
				img.onload = () => {
					if (this.fileOrBlob.name) {
						// the image comes from a file
						pica
							.resize(img, this.canvas, {
								unsharpAmount: 170,
								unsharpRadius: 0.6,
								unsharpThreshold: 5,
								quality: 3
							})
							.then(() => {
								debug('[ngOnInit] resize done !');
								//this.canvas.getContext('2d', { alpha: Boolean(alpha) }).drawImage(offScreenCanvas, 0, 0);
							});
					} else {
						// the image comes from the database
						this.canvas.getContext('2d').drawImage(img, 0, 0);
					}
				};
			}
		});
	}

	loadPhoto() {
		this.previewType = 'add';
		let el = this.inputUploader.nativeElement;
		if (el) {
			this.fileOrBlob = el.files[0];
			this.selectedFile = el.files[0];
			this.ngOnInit();
			//this.modalCtrl.dismiss({ choice: 'replace', file: el.files[0] });
		}
	}
}
