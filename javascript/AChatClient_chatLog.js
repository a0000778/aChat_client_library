'use strict';
/*
aChat Client Library
for JavaScript v1.0.0-beta
Chat log plugin v0.0.1
by a0000778
*/
(function(AChatClient){
var version=1;
var openingDB=new Map();
var openedDB=new Map();
AChatClient.pluginInit.push(function(onLoad){
	var _=this;
	this._chatLog_db=null;
	this.chatLog_status='wait login';
	//資料庫事件，多重開啟的情況下關閉其一使用
	this._chatLog_dbEv_error=function(error){
		_._error(error);
	};
	this._chatLog_dbEv_versionchange=function(){
		//提示需要關閉所有舊頁面才能升級
		_._emit('chatLog_needUpgrade');
	};
	this._chatLog_dbEv_close=function(){
		openedDB.delete(_._chatLog_db.name);
		_._chatLog_db=null;
	};
	
	this
		.on('online',this._chatLog_openDB)
		.on('offline',this._chatLog_closeDB)
	;
	onLoad();
});
AChatClient.prototype._chatLog_closeDB=function(logout,autoReconnect){
	if(!this._chatLog_db || autoReconnect) return;
	if(openedDB.get(this._chatLog_db.name).count===1)
		this._chatLog_db.close();
	else{
		openedDB.get(this._chatLog_db.name).count--;
		this._chatLog_db.removeEventListener('error',this._chatLog_dbEv_error);
		this._chatLog_db.removeEventListener('versionchange',this._chatLog_dbEv_versionchange);
		this._chatLog_db.removeEventListener('close',this._chatLog_dbEv_close);
		this._chatLog_db=null;
	}
	this.chatLog_status='wait login';
}
AChatClient.prototype._chatLog_initDB=function(db){
	if(this._chatLog_db) return;
	db.addEventListener('error',this._chatLog_dbEv_error);
	db.addEventListener('versionchange',this._chatLog_dbEv_versionchange);
	db.addEventListener('close',this._chatLog_dbEv_close);
	this._chatLog_db=db;
	this._emit('chatLog_loaded');
	this.chatLog_status='loaded';
}
AChatClient.prototype._chatLog_openDB=function(){
	if(this._chatLog_db || !this.userId) return;
	this.chatLog_status='loading';
	var _=this;
	var dbName=this.keyPrefix+'chatLog_'+this.userId;
	if(openingDB.has(dbName)){
		openingDB.get(dbName).push(function(){
			_._chatLog_openDB();
		});
	}else if(openedDB.has(dbName)){
		var dbInfo=openedDB.get(dbName);
		if(this.chatLog_status!='needUpgrade') dbInfo.count++;
		if(dbInfo.status=='opened')
			this._chatLog_initDB(dbInfo.db);
		else if(dbInfo.status=='needUpgrade'){
			this.chatLog_status='needUpgrade';
			dbInfo.waitOpen.push(function(){
				_._chatLog_openDB();
			});
			this._emit('chatLog_needUpgrade');
		}else if(dbInfo.status=='error'){
			this.chatLog_status='error';
			this._error(dbInfo.error);
		}
	}else{
		openingDB.set(dbName,[]);
		var clearOpeningDB=function(){
			for(var func of openingDB.get(dbName))
				func();
			openingDB.delete(dbName);
		};
		var req=indexedDB.open(dbName,version);
		req.addEventListener('error',function(error){
			openedDB.set(dbName,{'db': null,'count': 1,'status': 'error','error': error});
			_.chatLog_status='error';
			_._error(error);
			clearOpeningDB();
		});
		req.addEventListener('blocked',function(){
			openedDB.set(dbName,{'db': null,'count': 1,'status': 'needUpgrade','waitOpen':[]});
			_.chatLog_status='needUpgrade';
			_._emit('chatLog_needUpgrade');
			clearOpeningDB();
		});
		req.addEventListener('success',function(e){
			if(openedDB.has(dbName)){
				var dbInfo=openedDB.get(dbName);
				dbInfo.status='opened';
				_._chatLog_initDB(req.result);
				for(var func of dbInfo.waitOpen)
					func();
			}else{
				openedDB.set(dbName,{'db': req.result,'count': 1,'status': 'opened'});
				_._chatLog_initDB(req.result);
				clearOpeningDB();
			}
		});
		req.addEventListener('upgradeneeded',function(e){
			_._chatLog_initDB(req.result);
			_._chatLog_upgradeDB();
		});
	}
}
AChatClient.prototype._chatLog_upgradeDB=function(){
	if(this._chatLog_db.version===version){//建立用
		var objStore;
		objStore=this._chatLog_db.createObjectStore('channel',{'keyPath':'channelId'});
		objStore=this._chatLog_db.createObjectStore('user',{'keyPath':'userId'});
		objStore.createIndex('username','username',{'unique': true});
		objStore=this._chatLog_db.createObjectStore('chatLog',{'keyPath':'messageId'});
		objStore.createIndex('aboutUserId','aboutUserId');
		objStore.createIndex('aboutChannelId','aboutChannelId');
		objStore.createIndex('type','type');
	}else{//升級用
		switch(this._chatLog_db.version){}
	}
}
})(AChatClient);