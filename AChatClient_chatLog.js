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
	this._chatLog_downloadDelay=null;
	this._chatLog_downloadPrivate=false;
	this._chatLog_downloadPublic=false;
	this.chatLog_status='wait login';
	//資料庫事件，多重開啟的情況下關閉其一使用
	this._chatLog_dbEv_error=function(error){
		_._debug('[chatLog] 資料庫錯誤：%o',error);
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
	this
		.removeListener('chatGlobal',this._chatLog_emitAddLog)
		.removeListener('chatNormal',this._chatLog_emitAddLog)
		.removeListener('chatPrivate',this._chatLog_emitAddLog)
	;
	this.chatLog_status='wait login';
}
AChatClient.prototype._chatLog_downloadLog=function(startMessageId){
	//應使用Session最後登入時間同步
	this._chatLog_downloadPrivate && this._chatLog_downloadLog_private(startMessageId);
	this._chatLog_downloadPublic && this._chatLog_downloadLog_public(startMessageId);
	this._chatLog_downloadPrivate=false;
	this._chatLog_downloadPublic=false;
}
AChatClient.prototype._chatLog_downloadLog_format=function(messages){
	var _=this;
	var checkedChannel=new Set();
	var checkedUser=new Set();
	var channelList=new Map();
	var mEntries=messages.entries();
	var transaction,s_chatLog,s_channel,s_user;
	
	this.channelList(function(channels){
		channels.forEach(function(channel){
			channelList.set(channel.channelId,channel.name);
		});
		transaction=this._chatLog_db.transaction(['channel','chatLog','user'],'readwrite');
		s_chatLog=transaction.objectStore('chatLog');
		s_channel=transaction.objectStore('channel');
		s_user=transaction.objectStore('user');
		mSaveMessage();
	});

	function abort(error){
		_._error(error);
		transaction.abort();
	}
	function mSaveChannel(channelId){
		if(checkedChannel.has(channelId)) return;
		checkedChannel.add(channelId);
		var req=s_channel.get(IDBKeyRange.only(channelId));
		req.addEventListener('success',function(){
			if(!req.result && channelList.has(channelId))
				s_channel.add({'channelId': channelId,'name': channelList.get(channelId)});
		});
	}
	function mSaveMessage(){
		var message=mEntries.next();
		if(message.done) return;
		message=message.value[1];
		if(message.channelId!==null && !checkedChannel.has(message.channelId))
			mSaveChannel(message.channelId);
		if(message.fromUserId!==null && !checkedUser.has(message.fromUserId))
			mSaveUser(message.fromUserId,message.fromUsername);
		if(message.toUserId!==null && !checkedUser.has(message.toUserId))
			mSaveUser(message.toUserId,message.toUsername);
		delete message.fromUsername;
		delete message.toUsername;
		message.time=message.time.getTime();
		message.aboutUserId=message.fromUserId===_.userId? message.toUserId:message.fromUserId;
		var add=s_chatLog.add(message);
		add.addEventListener('success',mSaveMessage);
		add.addEventListener('error',abort);
	}
	function mSaveUser(userId,username){
		if(checkedUser.has(userId)) return;
		checkedUser.add(userId);
		var req=s_user.get(IDBKeyRange.only(userId));
		req.addEventListener('success',function(){
			if(!req.result)
				s_user.add({'userId': userId,'username':username});
		});
	}
}
AChatClient.prototype._chatLog_downloadLog_private=function(startMessageId){
	this._debug('[chatLog] 從 %d 開始下載密頻記錄 ...',startMessageId);
	this.chatLogQuery(
		{'type': 'private','startMessageId': startMessageId,'limit': 500},
		function(result){
			if(!result.length){
				this._debug('[chatLog] 密頻記錄下載完畢！');
				return;
			}
			if(result.length===500){
				var _=this;
				setTimeout(function(){
					_._chatLog_downloadLog_private(result[499].messageId+1);
				},1000);
			}else this._debug('[chatLog] 密頻記錄下載完畢！');
			this._chatLog_downloadLog_format(result);
		}
	);
}
AChatClient.prototype._chatLog_downloadLog_public=function(startMessageId){
	this._debug('[chatLog] 從 %d 開始下載公開記錄 ...',startMessageId);
	this.chatLogQuery(
		{'type': 'public','startMessageId': startMessageId,'limit': 500},
		function(result){
			if(!result.length){
				this._debug('[chatLog] 公開記錄下載完畢！');
				return;
			}
			if(result.length===500){
				var _=this;
				setTimeout(function(){
					_._chatLog_downloadLog_public(result[499].messageId+1);
				},1000);
			}else this._debug('[chatLog] 公開記錄下載完畢！');
			this._chatLog_downloadLog_format(result);
		}
	);
}
AChatClient.prototype._chatLog_emitAddLog=function(){
	if(arguments.length===6) this._chatLog_downloadPrivate=true;
	else if(arguments.length===4) this._chatLog_downloadPublic=true;
	else{
		this._chatLog_downloadPrivate=true;
		this._chatLog_downloadPublic=true;
	}
	if(this._chatLog_downloadDelay) return;
	this._debug('[chatLog] 下載新紀錄已列入排程 ...');
	var _=this;
	var cursor=this._chatLog_db
		.transaction('chatLog','readonly')
		.objectStore('chatLog')
		.openCursor(null,'prev')
	;
	var lastMessageId;
	cursor.addEventListener('success',function(){//public及private的startMessageId可能不同
		lastMessageId=cursor.result? cursor.result.key+1:1;
		_._chatLog_downloadDelay=setTimeout(function(){
			_._chatLog_downloadDelay=null;
			_._chatLog_downloadLog.call(_,lastMessageId);
		},600000);
	});
};
AChatClient.prototype._chatLog_initDB=function(db){
	if(this._chatLog_db) return;
	db.addEventListener('error',this._chatLog_dbEv_error);
	db.addEventListener('versionchange',this._chatLog_dbEv_versionchange);
	db.addEventListener('close',this._chatLog_dbEv_close);
	this._chatLog_db=db;
	this.chatLog_status='loaded';
	this._debug('[chatLog] 聊天記錄資料庫開啟成功！');
	this
		.on('chatGlobal',this._chatLog_emitAddLog)
		.on('chatNormal',this._chatLog_emitAddLog)
		.on('chatPrivate',this._chatLog_emitAddLog)
		._emit('chatLog_loaded')
	;
}
AChatClient.prototype._chatLog_openDB=function(){
	if(this._chatLog_db || !this.userId) return;
	this.chatLog_status='loading';
	this._debug('[chatLog] 開啟聊天記錄資料庫...');
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
			this._debug('[chatLog] 聊天記錄資料庫需要升級！等待資料庫關閉...');
			this._emit('chatLog_needUpgrade');
		}else if(dbInfo.status=='error'){
			this.chatLog_status='error';
			this._debug('[chatLog] 聊天記錄資料庫開啟失敗，錯誤：%o',dbInfo.error);
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
			_._debug('[chatLog] 聊天記錄資料庫開啟失敗，錯誤：%o',error);
			_._error(error);
			clearOpeningDB();
		});
		req.addEventListener('blocked',function(){
			openedDB.set(dbName,{'db': null,'count': 1,'status': 'needUpgrade','waitOpen':[]});
			_.chatLog_status='needUpgrade';
			_._debug('[chatLog] 聊天記錄資料庫需要升級！等待資料庫關閉...');
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
		this._debug('[chatLog] 建構聊天記錄資料庫...');
		var objStore;
		objStore=this._chatLog_db.createObjectStore('channel',{'keyPath':'channelId'});
		objStore=this._chatLog_db.createObjectStore('user',{'keyPath':'userId'});
		objStore.createIndex('username','username',{'unique': true});
		objStore=this._chatLog_db.createObjectStore('chatLog',{'keyPath':'messageId'});
		objStore.createIndex('time','time');
		objStore.createIndex('global',['time','toUserId','type']);
		objStore.createIndex('public',['time','channelId']);
		objStore.createIndex('private',['time','aboutUserId','type']);
	}else{//升級用
		switch(this._chatLog_db.version){}
	}
}
})(AChatClient);