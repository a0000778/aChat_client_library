'use strict';
/*
aChat Client Library
for JavaScript v1.0.0-beta
for aChat v2.0.0-beta
by a0000778
*/
(function(JSON,localStorage,Object,WebSocket,window){
function AChatClient(config,callback){
	if(!this.constructor.checkSupport())
		return false;
	config=config || {};
	if(!(config.wsServer || config.httpServer))
		throw new Error('必須指定 wsServer 或 httpServer');
	//設定檔
	Object.defineProperty(this,'wsServer',{
		'enumerable': true,
		'value': config.wsServer
	});
	Object.defineProperty(this,'httpServer',{
		'enumerable': true,
		'value': config.httpServer
	});
	Object.defineProperty(this,'keyPrefix',{
		'enumerable': true,
		'value': config.keyPrefix || (this.wsServer || this.httpServer).match(/\/\/[a-z0-9-]+(\.[a-z0-9-]+)*(:\d+)?/i)[0].slice(2)+'_'
	});
	this.autoReconnect=config.autoReconnect || true;
	//內部變數 - 通用
	this._event={
		'error': new Map(),
		'_question': new Map()
	};
	if(config.debug) this._debug=function(){ console.log.apply(console,arguments); }
	//內部變數 - 快取
	this._cache_channel=new Map();
	this._cache_channelUserList=new Set();
	this._cache_userProfile=new Map();
	this._clearCacheInterval=null;
	this._inQuery_channelUserList=new Set();
	this._inQuery_userProfile=new Set();
	//內部變數 - 連線驗證
	this._authData=null;
	this._db=null;
	this._inited=false;
	this._link=null;
	this._question=false;
	this._reConnectCount=0;
	//處理方法
	this.action=Object.create(this.constructor.action);
	//狀態資料
	this.actionGroup=null;
	this.channelId=null;
	this.userId=null;
	this.username=null;
	Object.defineProperty(this,'canAutoAuth',{
		'enumerable': true,
		'get': function(){ return !!_._authData; }
	});
	Object.defineProperty(this,'connected',{
		'enumerable': true,
		'get': function(){ return _._link && _._link.readyState===WebSocket.OPEN; }
	});

	var _=this;
	var waitCount=this.constructor.pluginInit.length+1;
	var onLoad=function(){
		if(--waitCount || _._inited) return;
		_._inited=true;
		_._emit('inited');
	}
	var onError=function(error){
		console.error(error);
		if(waitCount===-Infinity) return;
		waitCount=-Infinity;//強制無法載入完畢
		_._emit('inited',error);
	}
	callback && this.once('inited',callback);
	if(this._authData=localStorage.getItem(this.keyPrefix+'authData')){
		try{
			this._authData=JSON.parse(this._authData);
			if(!this._authData.userId || !this._authData.session)
				throw 'bad auth data';
		}catch(e){
			this._authData=null;
		}
	}
	//擴充功能初始化
	this.constructor.pluginInit.forEach(function(func){
		func.call(this,onError,onLoad);
	},this);
	setTimeout(onLoad,0);
}
AChatClient.pluginInit=[];//擴充功能初始化程式
AChatClient.action={
	'question': function(data){
		this._question=data.question;
		this._emit('_question');
	},
	'createSession': function(data){
		this._emit('createSession',data.userId,data.session);
		this.authBySession(data.userId,data.session);
	},
	'authBySession': function(data){
		if(data.status=='success' && this._checkId(data.userId)){
			this._clearCacheInterval=setInterval(this._clearCache,3600000,this);
			this.userId=data.userId;
			this.actionGroup=data.actionGroup;
			this._emit('auth','success');
			this.getProfile(this.userId,function(status,userId,profile){
				if(status==='success' && userId===this.userId)
					this.username=profile.username;
				this._emit('online');
			});
		}
	},
	'channel_exit': function(data){
		this.getProfile(data.userId,function(status,userId,profile){
			if(status!=='success') return;
			this._cache_channelUserList.delete(profile);
			this._emit('channelExit',data.userId,profile.username);
		});
	},
	'channel_join': function(data){
		this.getProfile(data.userId,function(status,userId,profile){
			if(status!=='success') return;
			this._cache_channelUserList.add(profile);
			this._emit('channelJoin',data.userId,profile.username);
		});
	},
	'channel_list': function(data,vEmit){
		if(!vEmit){
			this._cache_channel.clear();
			for(var channel of data.list)
				this._cache_channel.set(channel.channelId,channel);
		}
		this._emit('channelList',data.list);
	},
	'channel_switch': function(data,vEmit){
		if(!vEmit && (data.status=='success' || data.status=='force' || data.status=='default')){
			this.channelId=data.channelId;
			this._cache_channelUserList.clear();
		}
		if(this._cache_channel.size){
			this._emit(
				'channelSwitch',
				data.status,
				data.channelId,
				this._cache_channel.has(data.channelId)? this._cache_channel.get(data.channelId).name:'(unknown)'
			);
		}else{
			this.channelList(function(){
				this.action.channel_switch.call(this,data,true);
			});
		}
	},
	'channel_userList': function(data,vEmit){
		if(data.status=='success'){
			var userList=[];
			var waitCount=data.userList.length;
			this._inQuery_channelUserList.add(data.channelId);//來自伺服端主動發送更新的情況
			if(vEmit){
				this._emit('channelUserList',null,data.channelId,data.userList);
			}else if(data.channelId===this.channelId){
				var cache_channelUserList=this._cache_channelUserList;
				cache_channelUserList.clear();
				this.getProfile(data.userList,function(status,userId,profile){
					if(status==='success'){
						cache_channelUserList.add(profile);
						userList.push(profile);
					}
					if(--waitCount) return;
					this._inQuery_channelUserList.delete(data.channelId);
					this._emit('channelUserList',null,data.channelId,userList);
				});
			}else{
				this.getProfile(data.userList,function(status,userId,profile){
					if(status==='success')
						userList.push(profile);
					if(--waitCount) return;
					this._inQuery_channelUserList.delete(data.channelId);
					this._emit('channelUserList',null,data.channelId,userList);
				});
			}
		}else
			this._emit('channelUserList',data.status,data.channelId);
	},
	'chat_global': function(data){
		this._emit('chatGlobal',new Date(data.time),data.msg);
	},
	'chat_normal': function(data){
		this.getProfile(data.fromUserId,function(status,userId,profile){
			this._emit(
				'chatNormal',
				new Date(data.time),
				userId,
				status==='success'? profile.username:null,
				data.msg
			)
		});
	},
	'chat_notice': function(data){
		this._emit('chatNotice',new Date(data.time),data.msg);
	},
	'chat_private': function(data){
		var fromUsername,toUsername;
		this.getProfile([data.fromUserId,data.toUserId],function(status,userId,profile){
			if(userId===data.fromUserId) fromUsername=(status==='success'? profile.username:null);
			if(userId===data.toUserId) toUsername=(status==='success'? profile.username:null);
			if(fromUsername===undefined || toUsername===undefined) return;
			this._emit(
				'chatPrivate',
				new Date(data.time),
				data.fromUserId,
				fromUsername,
				data.toUserId,
				toUsername,
				data.msg
			);
		});
	},
	'chatlog_query': function(data){
		
	},
	'user_getProfile': function(data,vEmit){
		if(data.status=='success' && !vEmit){
			this._cache_userProfile.set(data.profile.userId,{
				'lastUse': Date.now(),
				'data': data.profile
			});
		}
		this._inQuery_userProfile.delete(data.profile.userId);
		this._emit('getUserProfile',data.status,data.profile.userId,data.profile);
	},
	'user_editProfile': function(data){
		if('status' in data)
			this._emit('editUserProfile',data.status);
	},
	'user_listSession': function(data){
		for(var session of data.sessions){
			session.createTime=new Date(session.createTime);
			session.lastLogin=new Date(session.lastLogin);
		}
		this._emit('listSession',data.sessions);
	},
	'user_removeSession': function(data){
		this._emit('removeSession',data.session,data.status);
	},
	'user_sendClient': function(data){
		
	}
}
AChatClient.checkSupport=function(){
	return ('WebSocket' in window) && ('Map' in window) && ('Set' in window);
}
AChatClient.statusCode={
	1000: '登出成功',
	1001: '伺服器關閉中',
	1006: '連線錯誤',
	1008: '拒絕連線',
	4000: '伺服器維護中',
	4001: '伺服器鎖定中',
	4002: '伺服器超載',
	4003: '伺服器錯誤',
	4100: '登入超時',
	4101: '帳號被停用',
	4102: '驗證失敗',
	4103: '重複登入',
	4104: '被踢出伺服器',
	4105: 'Session 已被刪除'
};
Object.defineProperty(AChatClient,'version',{
	'enumerable': true,
	'value': '1.0.0-beta'
});
AChatClient.prototype._ajax=function(method,path,data,callback){
	if(!this._checkOnline(true)){
		callback(new Error('no network'));
		return;
	}
	var _=this;
	var xhr=new XMLHttpRequest();
	xhr.addEventListener('error',function(e){
		_._debug('[AJAX] %s %s %o: %o',method.toUpperCase(),path,data,e);
		callback(e);
	});
	xhr.addEventListener('load',function(e){
		_._debug('[AJAX] %s %s %o: %s',method.toUpperCase(),path,data,xhr.responseText);
		callback(undefined,xhr.responseText);
	});
	xhr.open(method,this.httpServer+path);
	xhr.setRequestHeader('Content-Type', 'application/json');
	xhr.send(JSON.stringify(data));
}
AChatClient.prototype._checkId=function(id){
	return Number.isSafeInteger(id) && id>0;
};
AChatClient.prototype._checkLogin=function(callback){
	if(!this.connected){
		callback && callback('not connected');
		return false;
	}
	if(!this.userId){
		callback && callback('not authed');
		return false;
	}
	return true;
}
AChatClient.prototype._checkOnline=function(needOnline){
	if(navigator.onLine) return true;
	else if(needOnline) this._emit('needOnline');
	return false;
}
AChatClient.prototype._clearCache=function(_){
	var expire=Date.now()-86400000;
	var cache_userProfile=_._cache_userProfile;
	var cache_channelUserList=_._cache_channelUserList;
	for(var i of cache_userProfile.values()){
		if(i.lastUse<expire && !cache_channelUserList.has(i.data))
			cache_userProfile.delete(i.data.userId);
	}
}
AChatClient.prototype._clearStatus=function(){
	if(this.connected) return;
	this.actionGroup=null;
	this.channelId=null;
	this.userId=null;
	this.username=null;
}
AChatClient.prototype._connect=function(){
	if(this._link) return;
	if(!this.wsServer) this._error(new Error('必須指定 wsServer'))
	var _=this;
	var action=this.action;
	var link=this._link=new WebSocket(this.wsServer,'chatv1');
	link.addEventListener('close',function(ev){
		_._debug('[WebSocket] 連線中斷，代碼 %d: %s',ev.code,_.constructor.statusCode[ev.code] || '未知');
		_._link=null;
		_._cache_channel.clear();
		_._cache_channelUserList.clear();
		_._question=false;
		
		switch(ev.code){//驗證結果觸發
			case 4101: _._emit('auth','disabled'); return;
			case 4102: _._emit('auth','fail'); return;
			case 4103: _._emit('auth','repeat'); return;
		}
		
		if(ev.code===1006 && !this.userId){//非登入後斷線所導致
			_._emit('connectionFail');
		}else if(ev.code===1006 && _.autoReconnect && _._authData){//開啟自動重連的情況
			_._emit('offline',false,true,AChatClient.statusCode[ev.code] || '未知');
			if(_._checkOnline()){
				setTimeout(
					function(){
						if(this.userId)
							_.authBySession();
						else//清空狀態，停止自動重連的場合
							this._reConnectCount=0;
					},
					Math.min(_._reConnectCount*10000,60000)
				);
			}else{
				var waitReconnect=function(){
					removeEventListener('online',waitReconnect);
					_.authBySession();
				}
				addEventListener('online',waitReconnect);
			}
			_._reConnectCount++;
		}else{
			this._reConnectCount=0;
			_._clearStatus();
			_._emit('offline',ev.code===1000,false,AChatClient.statusCode[ev.code] || '未知');
		}
	});
	link.addEventListener('error',function(error){
		_._debug('[WebSocket] 連線發生錯誤: %o',error);
		_._error(error);
	});
	link.addEventListener('message',function(data){
		_._debug('[WebSocket] 收到資料: %o',data.data);
		try{
			data=JSON.parse(data.data);
		}catch(e){
			_._error(new Error('用戶端指令解析失敗'));
			return;
		}
		if(typeof(data.action)==='string' && typeof(action[data.action])==='function'){
			_._debug('[Action] 執行指令 %s: %o',data.action,data);
			action[data.action].call(_,data);
		}else
			_._error(new Error('用戶端指令格式錯誤或'));
	});
	link.addEventListener('open',function(){
		_._debug('[WebSocket] 連線已建立');
		_._reConnectCount=0;
		_._send({'action':'client','client':'aChatClientLibrary for Javascript '+AChatClient.version})
		_._emit('_connect');
	});
}
AChatClient.prototype._createQuestion=function(callback){
	var checkGet=function(){
		if(this._question){//已取得 question，執行 callback
			callback.call(this,this._question);
			this.removeListener('_question',checkGet);
			this._question=false;//question 已被使用，清除
		}else if(this._question===false){//未取得 question，發出請求
			this._send({'action': 'createQuestion'});
			this._question=null;
		}//未取得 question，前面已有其他事件發出請求，什麼都不做
	}
	//利用 JS 非同步執行順序，不可將發出請求及事件對調
	if(!this._event._question.size)
		this._send({'action': 'createQuestion'});
	this.on('_question',checkGet);
}
AChatClient.prototype._debug=function(){}
AChatClient.prototype._emit=function(evName){//evName,arg1,arg2...
	var args=Array.prototype.slice.call(arguments,1);
	this._debug('[Event] Emit %s: %o',evName,args);
	if(this._event.hasOwnProperty(evName)){
		for(var func of this._event[evName]){
			this._debug('[Event] -> %o',func[0]);
			func[1].apply(this,args);
		}
	}
	return this;
}
AChatClient.prototype._error=function(error){
	if(this._event.error.size)
		this._emit('error',error);
	else
		throw error;
}
AChatClient.prototype._passwordHash=function(password){
	return new CryptoJS.algo.SHA256.init().update(CryptoJS.MD5(password)).finalize(password).toString();
}
AChatClient.prototype._passwordHmac=function(question,password){
	return CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256,CryptoJS.enc.Hex.parse(password))
		.update(CryptoJS.enc.Hex.parse(question))
		.finalize()
		.toString()
	;
}
AChatClient.prototype._send=function(data){
	if(this.connected){
		this._debug('[WebSocket] 發送資料: %o',data);
		this._link.send(JSON.stringify(data));
		return true;
	}
	return false;
}
AChatClient.prototype.authBySession=function(userId,session,callback){
	if(!this._inited || this.userId) return;
	if(typeof(userId)==='function'){
		callback=userId;
		userId=undefined;
	}
	var authData;
	if(this._checkId(userId) && typeof(session)==='string'){
		authData=this._authData={
			'userId': userId,
			'session': session
		};
		localStorage.setItem(this.keyPrefix+'authData',JSON.stringify(authData));
	}else if(this._authData){
		authData=this._authData;
	}else
		throw new Error('缺少驗證資料');
	callback && this.once('auth',callback);
	var authBySession=function(){
		this._send({
			'action': 'authBySession',
			'userId': authData.userId,
			'session': authData.session
		});
	};
	var clearEvent=function(){
		this
			.removeListener('_connect',authBySession)
			.removeListener('auth',clearEvent)
			.removeListener('connectionFail',clearEvent)
		;
		callback && this.removeListener('auth',callback);
	}
	this
		.once('auth',clearEvent)
		.once('connectionFail',clearEvent)
	;
	if(!this._link) this._connect();
	if(this.connected) authBySession.call(this);
	else this.once('_connect',authBySession);
}
AChatClient.prototype.authByPassword=function(username,password,callback){
	if(!this._inited || this.userId) return;
	if(!username || !password)
		throw new Error('缺少驗證資料');
	var authData={
		'username': username,
		'password': this._passwordHash(password)
	};
	callback && this.once('auth',callback);
	var createSession=function(){
		this._createQuestion(function(question){
			this._send({
				'action': 'createSession',
				'username': authData.username,
				'answer': this._passwordHmac(question,authData.password)
			});
		});
	}
	var clearEvent=function(){
		this
			.removeListener('_connect',createSession)
			.removeListener('auth',clearEvent)
			.removeListener('connectionFail',clearEvent)
		;
		callback && this.removeListener('auth',callback);
	}
	this
		.once('auth',clearEvent)
		.once('connectionFail',clearEvent)
	;
	if(!this._link) this._connect();
	if(this.connected) createSession.call(this);
	else this.once('_connect',createSession);
}
AChatClient.prototype.channelList=function(callback){
	if(!this._inited || !this._checkLogin(callback)) return;
	callback && this.once('channelList',callback);
	if(this._cache_channel.size){
		var list=[];
		for(var channel of this._cache_channel.values())
			list.push(channel);
		this.action.channel_list.call(this,{
			'action': 'channel_list',
			'list': list
		},true);
	}else
		this._send({'action': 'channel_list'});
}
AChatClient.prototype.channelSwitch=function(channelId,callback){
	if(!this._inited || !this._checkLogin(callback)) return;
	if(!this._checkId(channelId))
		throw new Error('ChannelId format error.');
	this._send({
		'action': 'channel_switch',
		'channelId': channelId
	});
	callback && this.once('channelSwitch',callback);
}
AChatClient.prototype.channelUserList=function(channelId,callback){
	if(!this._inited || !this._checkLogin(callback)) return;
	var cmd={'action': 'channel_userList'};
	if(typeof(channelId)==='function'){
		callback=channelId;
		channelId=undefined;
	}else if(channelId && !this._checkId(channelId)){
		throw new Error('ChannelId format error.');
	}
	callback && this.once('channelUserList',callback);
	if(this._inQuery_channelUserList.has(channelId)) return;
	if(channelId===this.channelId && this._cacheChannelUserList.size){
		var list=[];
		for(var u of this._cache_channelUserList)
			list.push(u);
		this.action.channel_userList.call(this,{
			'action': 'channel_userList',
			'status': 'success',
			'channelId': channelId,
			'list': list
		},true);
	}else{
		this._inQuery_channelUserList.add(channelId);
		this._send({
			'action': 'channel_userList',
			'channelId': channelId
		});
	}
}
AChatClient.prototype.chatSend=function(type,toUserId,msg){
	if(!this._inited || !this._checkLogin() || msg===undefined) return false;
	msg=msg.toString();
	if(msg.length===0) return false;
	if(type=='normal'){
		this._send({
			'action': 'chat_normal',
			'msg': msg
		});
	}else if(type=='private' && this._checkId(toUserId)){
		this._send({
			'action': 'chat_private',
			'toUserId': toUserId,
			'msg': msg
		});
	}else return false;
	return true;
}
AChatClient.prototype.checkEmail=function(code,callback){
	if(!this._inited) return;
	if(this.httpServer===null)
		this._error(new Error('httpServer not found'));
	this._ajax('post','/v1/mail',{
		'code': code
	},callback);
}
AChatClient.prototype.editProfile=function(password,profileData,callback){
	if(!this._inited || !this._checkLogin(callback)) return;
	if(typeof(profileData)!=='object')
		throw new Error('修改資料有誤');
	if(typeof(password)!=='string')
		throw new Error('修改資料需要目前密碼');
	var sendData={'action': 'user_editProfile'};
	for(var field in profileData){
		if(field=='action')
			throw new Error('profile 不支援 action 欄位');
		else if(field=='password')
			sendData[field]=this._passwordHash(profileData[field]);
		else
			sendData[field]=profileData[field];
	}
	this._createQuestion(function(question){
		sendData.answer=this._passwordHmac(question,this._passwordHash(password));
		this._send(sendData);
	});
	callback && this.once('editUserProfile',callback);
}
AChatClient.prototype.forgotPassword=function(email,callback){
	if(!this._inited) return;
	if(this.httpServer===null)
		this._error(new Error('httpServer not found'));
	this._ajax('post','/v1/forgotPassword',{
		'email': email
	},callback);
}
AChatClient.prototype.getProfile=function(userIds,callback){//改為使用者自身以外完全快取
	if(!this._inited || !this._checkLogin(callback)) return;
	if(typeof(userIds)==='function'){
		callback=userIds;
		userIds=undefined;
	}
	if(Array.isArray(userIds)){
		if(!userIds.every(this._checkId))
			throw new Error('userIds 不合法');
	}else if(userIds===undefined)
		userIds=[this.userId];
	else if(this._checkId(userIds))
		userIds=[userIds];
	else
		throw new Error('userIds 不合法');
	if(callback){
		var waitResult=new Set(userIds);
		var cbCheck=function(status,userId,profile){
			if(!waitResult.has(userId)) return;
			waitResult.delete(userId);
			callback.call(this,status,userId,profile);
			if(!waitResult.size) this.removeListener('getUserProfile',cbCheck);
		};
		this.on('getUserProfile',cbCheck);
	}
	var query=[];
	var u,cu;
	for(u of userIds){
		if(this._inQuery_userProfile.has(u))
			continue;
		if(u===this.userId){//論其他用戶端更新 E-mail 的可能性
			this._inQuery_userProfile.add(u);
			query.push(u);
		}else if(cu=this._cache_userProfile.get(u)){//其他使用者可取得的資料都是靜態的，快取全開
			cu.lastUse=Date.now();
			this.action.user_getProfile.call(this,{
				'action': 'user_getProfile',
				'status': 'success',
				'profile': cu.data
			},true);
		}else{
			this._inQuery_userProfile.add(u);
			query.push(u);
		}
	}
	if(query.length) this._send({
		'action': 'user_getProfile',
		'userIds': userIds
	});
	return true;
}
AChatClient.prototype.listSession=function(callback){
	if(!this._inited || !this._checkLogin(callback)) return;
	callback && this.once('listSession',callback);
	this._send({'action':'user_listSession'});
}
AChatClient.prototype.removeSession=function(session,callback){
	if(!this._inited || !this._checkLogin(callback)) return;
	if(typeof(session)!=='string')
		throw new Error('缺少 session 欄位或型態錯誤');
	callback && this.once('removeSession',callback);
	this._send({
		'action':'user_removeSession',
		'session': session
	});
}
AChatClient.prototype.logout=function(){
	if(!this._inited) return;
	if(this._checkLogin()){
		this._send({
			'action': 'user_logout'
		});
	}else
		this._clearStatus();
	clearInterval(this._clearCacheInterval);
	this._clearCache(this);
	this._clearCacheInterval=null;
	this._authData=null;
	localStorage.removeItem(this.keyPrefix+'authData');
}
AChatClient.prototype.on=function(evName,func){
	this._debug('[Event] Listener %s: %o',evName,func);
	if(this._event.hasOwnProperty(evName))
		this._event[evName].set(func,func);
	else
		this._event[evName]=new Map([[func,func]]);
	return this;
}
AChatClient.prototype.once=function(evName,func){
	this._debug('[Event] Listener (once) %s: %o',evName,func);
	var autoRemove=function(){
		this._debug('[Event] Remove listener %s: %o',evName,func);
		this.removeListener(evName,func);
		func.apply(this,arguments);
	}
	if(this._event.hasOwnProperty(evName))
		this._event[evName].set(func,autoRemove);
	else
		this._event[evName]=new Map([[func,autoRemove]]);
	return this;
}
AChatClient.prototype.register=function(username,email,password,callback){
	if(!this._inited) return;
	if(this.httpServer===null)
		this._error(new Error('httpServer not found'));
	this._ajax('post','/v1/register',{
		'username': username,
		'email': email,
		'password': this._passwordHash(password)
	},callback);
}
AChatClient.prototype.resetPassword=function(code,callback){
	if(!this._inited) return;
	if(this.httpServer===null)
		this._error(new Error('httpServer not found'));
	this._ajax('post','/v1/resetPassword',{
		'code': code
	},callback);
}
AChatClient.prototype.removeListener=function(evName,func){
	var index,event=this._event;
	if(!evName)
		this._event={
			'error': new Map(),
			'_question': new Map()
		};
	else if(this._event.hasOwnProperty(evName)){
		if(func) this._event[evName].delete(func);
		else this._event[evName].clear();
	}
	return this;
}

window.AChatClient=AChatClient;
})(JSON,window.localStorage,Object,window.WebSocket,window);