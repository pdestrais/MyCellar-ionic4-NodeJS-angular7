import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { UserModel } from '../models/cellar.model';

import * as jwt_decode from 'jwt-decode';

@Injectable({ providedIn: 'root' })
export class AuthenticationService {
	private currentUserSubject: BehaviorSubject<UserModel>;
	public currentUser: Observable<UserModel>;

	constructor(private http: HttpClient) {
		this.currentUserSubject = new BehaviorSubject<UserModel>(JSON.parse(localStorage.getItem('currentUser')));
		this.currentUser = this.currentUserSubject.asObservable();
	}

	public get currentUserValue(): UserModel {
		return this.currentUserSubject.value;
	}

	login(username: string, password: string) {
		// let url = window.location.origin + '/api/login';
		// for dev purposes
		let url = 'http://localhost:5001' + '/api/login';

		return this.http.post<any>(url, { username, password }).pipe(
			map((user) => {
				// login successful if there's a jwt token in the response
				if (user && user.token) {
					// store user details and jwt token in local storage to keep user logged in between page refreshes
					//localStorage.setItem('previousUser', JSON.stringify(this.currentUserValue));
					localStorage.setItem('currentUser', JSON.stringify(user));
					this.currentUserSubject.next(user);
				}
				return user;
			})
		);
	}

	logout() {
		// remove user from local storage to log user out
		localStorage.setItem('previousUser', JSON.stringify(this.currentUserValue));
		localStorage.removeItem('currentUser');
		this.currentUserSubject.next(null);
	}

	getTokenExpirationDate(token: string): Date {
		const decoded = jwt_decode(token);

		if (decoded.exp === undefined) return null;

		const date = new Date(0);
		date.setUTCSeconds(decoded.exp);
		return date;
	}

	isTokenExpired(token?: string): boolean {
		if (!token) token = this.currentUserValue ? this.currentUserValue.token : null;
		if (!token) return true;

		const date = this.getTokenExpirationDate(token);
		if (date === undefined) return false;
		return !(date.valueOf() > new Date().valueOf());
	}

	register(user: UserModel) {
		let url;
		if (this.currentUserValue && this.currentUserValue.admin) url = 'http://localhost:5001' + '/api/register';
		else url = 'http://localhost:5001' + '/api/registerViaMail';
		//		if (this.currentUserValue.username == 'pdestrais') url = window.location.origin + '/api/register';
		//		else url = window.location.origin + '/api/registerViaMail';
		return this.http.post<any>(url, user).pipe(
			map((result) => {
				if (result.ok) return true;
				else return false;
			})
		);
	}
}
