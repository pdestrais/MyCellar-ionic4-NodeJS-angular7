import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

const routes: Routes = [
	{
		path: '',
		redirectTo: 'home',
		pathMatch: 'full'
	},
	{
		path: 'home',
		loadChildren: './home/home.module#HomePageModule'
	},
	{ path: 'preferences', loadChildren: './preferences/preferences.module#PreferencesPageModule' },
	{ path: 'vin', loadChildren: './vin/vin.module#VinPageModule' },
	{ path: 'vin/:id', loadChildren: './vin/vin.module#VinPageModule' },
	{
		path: 'appellations',
		loadChildren: './appellation/appellation.module#AppellationPageModule',
		data: { action: 'list' }
	},
	{
		path: 'appellation',
		loadChildren: './appellation/appellation.module#AppellationPageModule',
		data: { action: 'edit' }
	},
	{
		path: 'appellation/:id',
		loadChildren: './appellation/appellation.module#AppellationPageModule',
		data: { action: 'edit' }
	},
	{
		path: 'type',
		loadChildren: './type/type.module#TypePageModule',
		data: { action: 'edit' }
	},
	{
		path: 'types',
		loadChildren: './type/type.module#TypePageModule',
		data: { action: 'list' }
	},
	{
		path: 'type/:id',
		loadChildren: './type/type.module#TypePageModule',
		data: { action: 'edit' }
	},
	{
		path: 'region',
		loadChildren: './region/region.module#RegionPageModule',
		data: { action: 'edit' }
	},
	{
		path: 'region/:id',
		loadChildren: './region/region.module#RegionPageModule',
		data: { action: 'edit' }
	},
	{
		path: 'regions',
		loadChildren: './region/region.module#RegionPageModule',
		data: { action: 'list' }
	},
	{
		path: 'stats',
		loadChildren: './stats/stats.module#StatsPageModule'
	},
	{ path: 'readytodrink', loadChildren: './ready-to-drink/ready-to-drink.module#ReadyToDrinkPageModule' },
	{ path: 'about', loadChildren: './about/about.module#AboutPageModule' },
	{ path: 'rapport', loadChildren: './rapport/rapport.module#RapportPageModule' }
];

@NgModule({
	imports: [ RouterModule.forRoot(routes /* , {
			enableTracing: true
		} */) ],
	exports: [ RouterModule ]
})
export class AppRoutingModule {}
