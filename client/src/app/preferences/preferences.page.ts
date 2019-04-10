import { Component, OnInit, NgZone } from '@angular/core';
import { Location } from '@angular/common';

import * as Debugger from 'debug';
import { TranslateService } from '@ngx-translate/core';
const debug = Debugger('app:preferences');

@Component({
	selector: 'app-preferences',
	templateUrl: './preferences.page.html',
	styleUrls: [ './preferences.page.scss' ]
})
export class PreferencesPage implements OnInit {
	public language: string = 'en';
	public supportedLanguages: Map<string, string> = new Map([ [ 'fr', 'français' ], [ 'en', 'english' ] ]);
	constructor(private location: Location, private zone: NgZone, private translate: TranslateService) {}

	ngOnInit() {
		debug('[ngOnInit]');
		this.zone.run(() => (this.language = window.localStorage.getItem('myCellar.language')));
	}

	goBack() {
		this.location.back();
	}

	languageChange(val: any) {
		this.language = val.detail.value;
		debug('Language Change:', val);
		this.zone.run(() => {
			this.translate.use(this.language).subscribe((changed) => {
				window.localStorage.setItem('myCellar.language', this.language);
			});
		});
	}
}
