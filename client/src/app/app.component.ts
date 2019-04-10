import { PouchdbService } from './services/pouchdb.service';
import { Component } from '@angular/core';

import { Platform, MenuController } from '@ionic/angular';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { timeout } from 'q';

import { SideMenuSettings } from './multi-level-side-menu/models/side-menu-settings';
import { SideMenuOption } from './multi-level-side-menu/models/side-menu-option';
import { MultiLevelSideMenuComponent } from './multi-level-side-menu/multi-level-side-menu.component';

import { AuthenticationService } from './services/auth.service';
import { UserModel } from './models/cellar.model';

import * as Debugger from 'debug';
const debug = Debugger('app:root');

@Component({
	selector: 'app-root',
	templateUrl: 'app.component.html',
	styleUrls: [ './app.component.scss' ]
})
export class AppComponent {
	public appMenuItems: Array<any>;

	// Options to show in the SideMenuContentComponent
	public options: Array<SideMenuOption>;

	// Settings for the SideMenuContentComponent
	public sideMenuSettings: SideMenuSettings = {
		accordionMode: true,
		showSelectedOption: true,
		selectedOptionClass: 'active-side-menu-option'
	};
	private currentUser: UserModel;

	constructor(
		private platform: Platform,
		private splashScreen: SplashScreen,
		private statusBar: StatusBar,
		private translate: TranslateService,
		private router: Router,
		private menuCtrl: MenuController,
		private authenticationService: AuthenticationService,
		private dataService: PouchdbService
	) {
		this.initializeApp();
		this.authenticationService.currentUser.subscribe((x) => {
			this.currentUser = x;
			if (x == null) {
				debug('[login / logout subscriber]user just logged out');
				this.router.navigate([ '/login' ]);
			}
		});
	}

	initializeApp() {
		this.platform.ready().then(() => {
			this.statusBar.styleDefault();
			this.splashScreen.hide();
			let lang = window.localStorage.getItem('myCellar.language');
			if (lang) this.translate.setDefaultLang(lang);
			else {
				this.translate.setDefaultLang('en');
				window.localStorage.setItem('myCellar.language', 'en');
			}
			window.setTimeout(() => {
				this.initializeOptions();
			}, 500);
		});
	}

	private initializeOptions(): void {
		this.options = new Array<SideMenuOption>();
		this.options = [
			{
				displayText: this.translate.instant('page.search'),
				route: [ '' ],
				iconSrc: './assets/imgs/search.svg'
			},
			{
				displayText: this.translate.instant('page.wine'),
				route: [ '/vin' ],
				iconSrc: './assets/imgs/vin_verre.svg'
			},
			{
				displayText: this.translate.instant('page.region'),
				route: [ '/regions' ],
				iconSrc: './assets/imgs/region.svg'
			},
			{
				displayText: this.translate.instant('page.appellation'),
				route: [ '/appellations' ],
				iconSrc: './assets/imgs/appellation.svg'
			},
			{
				displayText: this.translate.instant('page.type'),
				route: [ '/types' ],
				iconSrc: './assets/imgs/wine_type.svg'
			},
			{
				displayText: this.translate.instant('page.report'),
				suboptions: [
					{
						displayText: this.translate.instant('report.yearlyReport'),
						route: [ '/rapport/bytyo/types' ],
						iconSrc: './assets/imgs/rapport.svg'
					},
					{
						displayText: this.translate.instant('report.typeReport'),
						route: [ '/rapport/bytoy/types' ],
						iconSrc: './assets/imgs/rapport.svg'
					},
					{
						displayText: this.translate.instant('report.readyToDrink'),
						route: [ '/readytodrink' ],
						iconSrc: './assets/imgs/rapport.svg'
					},
					{
						displayText: this.translate.instant('page.report') + 'PDF',
						route: [ '/rapport/pdf' ],
						iconSrc: './assets/imgs/rapportpdf.svg'
					}
				]
			},
			{
				displayText: this.translate.instant('page.stats'),
				route: [ '/stats' ],
				iconSrc: './assets/imgs/statistics.svg'
			},
			{
				displayText: this.translate.instant('page.config'),
				route: [ '/preferences' ],
				iconSrc: './assets/imgs/settings.svg'
			},
			{
				displayText: this.translate.instant('page.about'),
				route: [ '/about' ],
				iconSrc: './assets/imgs/about.svg'
			},
			{
				displayText: this.translate.instant('page.logout') + ' (' + this.currentUser.username + ')',
				custom: 'logout',
				iconSrc: './assets/imgs/logout.svg'
			}
		];
		if (this.currentUser && this.currentUser != null && this.currentUser.admin)
			this.options.splice(this.options.length - 2, 0, {
				displayText: this.translate.instant('page.register'),
				route: [ '/register' ],
				iconSrc: './assets/imgs/sign-in.svg'
			});
	}

	public onOptionSelected(option: SideMenuOption): void {
		if (option.custom == 'logout') this.authenticationService.logout();
		else this.menuCtrl.close().then((result) => this.router.navigate(option.route));

		/* 		this.menuCtrl.close().then(() => {
			if (option.custom && option.custom.isLogin) {
				this.presentAlert('You\'ve clicked the login option!');
			} else if (option.custom && option.custom.isLogout) {
				this.presentAlert('You\'ve clicked the logout option!');
			} else if (option.custom && option.custom.isExternalLink) {
				let url = option.custom.externalUrl;
				window.open(url, '_blank');
			} else {
				// Get the params if any
				const params = option.custom && option.custom.param;

				// Redirect to the selected page
				this.navCtrl.setRoot(option.component, params);
			}
		});
 */
	}
}
