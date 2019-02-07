import { Component, OnInit } from '@angular/core';

@Component({
	selector: 'app-about',
	templateUrl: './about.page.html',
	styleUrls: [ './about.page.scss' ]
})
export class AboutPage implements OnInit {
	public appInfo: any = { name: 'MyCellar', version: '2.2', author: 'Philippe Destrais', ionic: '4', angular: '7' };

	constructor() {}

	ngOnInit() {}
}
