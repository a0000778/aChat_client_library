'use strict';
/*
aChat Client Library
for JavaScript v1.0.0-beta
for aChat v2.0.0-beta
by a0000778
*/
function AChatClient(config){
	if(!this.constructor.checkSupport())
		return false;
	config=config || {};
	this.action={};
	this.actionGroup=null;
	this.userId=null;
	this.username=null;
	this.authData=null;
	this.autoLogin=('autoLogin' in config)? !!config.autoLogin:true;
	this.autoReconnect=('autoReconnect' in config)? !!config.autoReconnect:true;
	this.channelId=null;
	this.connected=false;
	this.event={
		'error': [],
		'_question': [],
		'auth': [],
		'channelExit': [],
		'channelJoin': [],
		'channelList': [],
		'channelSwitch': [],
		'channelUserList': [],
		'chatGlobal': [],
		'chatNormal': [],
		'chatNotice': [],
		'chatPrivate': [],
		'close': [],
		'connect': [],
		'createSession': [],
		'editUserProfile': [],
		'getUserProfile': [],
		'needOnline': []
	}
	this.link=null;
	this.server=config.server;
	this.httpServer=config.httpServer || null;
	this._cacheUser=new Map();
	this._cacheChannel=null;
	this._cacheChannelUserList=new Set();
	this._question=false;
	
	var action,actionDefault=this.constructor.action;
	for(action in actionDefault){
		this.action[action]=actionDefault[action];
	}
	if(this.autoLogin){
		if(localStorage.authData){
			try{
				this.authData=JSON.parse(localStorage.authData);
				setTimeout(this.authBySession.bind(this),0);//丟到下一輪執行，避免相關事件還未掛上
			}catch(e){
				this.authData=null;
			}
		}
		this.on('createSession',function(userId,session){
			this.authData={
				'userId': userId,
				'session': session
			};
			localStorage.authData=JSON.stringify(this.authData);
		});
	}else
		delete localStorage.authData;
}
AChatClient.action={
	'question': function(data){
		this._question=data.question;
		this._emit('_question');
	},
	'createSession': function(data){
		this._emit('createSession',data.userId,data.session)
	},
	'authBySession': function(data){
		if(data.status=='success' && this._checkId(data.userId)){
			this.userId=data.userId;
			this.actionGroup=data.actionGroup;
			this.getProfile(this.userId,function(status,userId,profile){
				if(status==='success' && userId===this.userId)
					this.username=profile.username;
				this._emit('auth','success');
			});
		}
	},
	'channel_exit': function(data){
		this._cacheChannelUserList.delete(data.userId);
		if(this._cacheUser.has(data.userId))
			this._emit('channelExit',data.userId,this._cacheUser.get(data.userId).username);
		else{
			this.getProfile(data.userId,function(status,userId,profile){
				this._emit('channelExit',data.userId,profile.username);
			});
		}
	},
	'channel_join': function(data){
		this._cacheChannelUserList.add(data.userId);
		if(this._cacheUser.has(data.userId))
			this._emit('channelJoin',data.userId,this._cacheUser.get(data.userId).username);
		else{
			this.getProfile(data.userId,function(status,userId,profile){
				this._emit('channelJoin',data.userId,profile.username);
			});
		}
	},
	'channel_list': function(data,vEmit){
		if(!vEmit)
			this._cacheChannel=data.list.slice();
		this._emit('channelList',data.list);
	},
	'channel_switch': function(data){
		if(data.status=='success' || data.status=='force' || data.status=='default'){
			this.channelId=data.channelId;
			this._cacheChannelUserList.clear();
		}
		this.channelList(function(channelList){
			var channel=channelList.find(function(ele){
				return ele.channelId===data.channelId;
			});
			this._emit('channelSwitch',data.status,data.channelId,channel? channel.name:'(unknown)');
		});
	},
	'channel_userList': function(data,vEmit){
		if(data.status=='success'){
			var userList=[];
			var wait=data.userList.length;
			if(data.channelId===this.channelId){
				if(!vEmit){
					this._cacheChannelUserList.clear();
					for(var userId of data.userList)
						this._cacheChannelUserList.add(userId);
				}
				data.userList.splice(data.userList.indexOf(this.userId),1);
				userList.push({'userId': this.userId,'username': this.username});
				wait--;
			}
			if(!wait){
				this._emit('channelUserList',null,data.channelId,userList);
			}
			this.getProfile(data.userList,function(status,userId,profile){
				if(status==='success')
					userList.push({'userId': userId,'username': profile.username});
				if(--wait) return;
				userList=userList.sort();
				this._emit('channelUserList',null,data.channelId,userList.sort());
			});
		}else
			this._emit('channelUserList',data.status,data.channelId);
	},
	'chat_global': function(data){
		if(data.hasOwnProperty('status'))
			this._emit('chatGlobal',data.status);
		else
			this._emit('chatGlobal',new Date(data.time),data.msg);
	},
	'chat_normal': function(data){
		if(this._checkId(data.fromUserId) && typeof(data.msg)=='string'){
			if(this._cacheUser.has(data.formUserId))
				this._emit('chatNormal',new Date(data.time),data.fromUserId,this._cacheUser.get(data.fromUserId).username,data.msg);
			else{
				this.getProfile(data.fromUserId,function(status,userId,profile){
					this._emit(
						'chatNormal',
						new Date(data.time),
						data.fromUserId,
						status==='success'? profile.username:null,
						data.msg
					);
				});
			}
		}
	},
	'chat_notice': function(data){
		this._emit('chatNotice',new Date(data.time),data.msg);
	},
	'chat_private': function(data){
		if(this._checkId(data.fromUserId) && this._checkId(data.toUserId) && typeof(data.msg)=='string'){
			var findUsername=[];
			this._cacheUser.has(data.fromUserId) || findUsername.push(data.fromUserId);
			this._cacheUser.has(data.toUserId) || findUsername.push(data.toUserId);
			if(findUsername.length){
				this.getProfile(findUsername,function(error,userId){
					findUsername.splice(findUsername.indexOf(userId),1);
					if(!findUsername.length)
						this._emit('chatPrivate',new Date(data.time),data.fromUserId,this._cacheUser.get(data.fromUserId).username,data.toUserId,this._cacheUser.get(data.toUserId).username,data.msg);
				});
			}else
				this._emit('chatPrivate',new Date(data.time),data.fromUserId,this._cacheUser.get(data.fromUserId).username,data.toUserId,this._cacheUser.get(data.toUserId).username,data.msg);
		}
	},
	'user_getProfile': function(data,vEmit){
		if(data.status=='success')
			vEmit || this._cacheUser.set(data.profile.userId,data.profile);
		this._emit('getUserProfile',data.status,data.profile.userId,data.profile);
	},
	'user_editProfile': function(data){
		if('status' in data)
			this._emit('editUserProfile',data.status);
	}
}
AChatClient.checkSupport=function(){
	return ('WebSocket' in window) && ('Map' in window);
}
AChatClient.statusCode={
	1000: 'logout',
	1006: 'connection error',
	4000: 'server maintenance',
	4001: 'server locked',
	4002: 'server overLoad',
	4003: 'server error',
	4100: 'auth timeout',
	4101: 'account disabled',
	4102: 'auth fail',
	4103: 'repeat login',
	4104: 'server kick'
};
AChatClient.prototype._ajax=function(method,path,data,callback){
	if(!this._checkOnline(true)){
		callback(new Error('no network'));
		return;
	}
	var xhr=new XMLHttpRequest();
	xhr.addEventListener('error',function(e){
		callback(e);
	});
	xhr.addEventListener('load',function(e){
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
	if(!this.event._question.length)
		this._send({'action': 'createQuestion'});
	this.on('_question',checkGet);
}
AChatClient.prototype._emit=function(evName){//evName,arg1,arg2...
	if(this.event.hasOwnProperty(evName)){
		var args=Array.prototype.slice.call(arguments,1);
		this.event[evName].forEach(function(func){
			func.apply(this,args);
		},this);
	}
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
	if(this.link){
		this.link.send(JSON.stringify(data));
		return true;
	}
	return false;
}
AChatClient.prototype.authBySession=function(userId,session,callback){
	var authData;
	if(this._checkId(userId) && typeof(session)==='string'){
		authData={
			'userId': userId,
			'session': session
		};
		if(this.autoLogin)
			localStorage.authData=JSON.stringify(authData);
	}else if(this.authData){
		authData={
			'userId': this.authData.userId,
			'session': this.authData.session
		};
		if(!this.autoReconnect)
			this.authData=null;
	}else
		throw new Error('缺少驗證資料');
	if(typeof(userId)==='function'){
		callback=userId;
		userId=undefined;
	}
	if(this.connected){
		callback && this.once('auth',callback);
		this._send({
			'action': 'authBySession',
			'userId': authData.userId,
			'session': authData.session
		});
	}else{
		if(!this.link) this.connect();
		this.once('connect',function(error){
			if(error) return;
			callback && this.once('auth',callback);
			this._send({
				'action': 'authBySession',
				'userId': authData.userId,
				'session': authData.session
			});
		});
	}
}
AChatClient.prototype.channelList=function(callback){
	if(!this._checkLogin(callback)) return;
	callback && this.once('channelList',callback);
	if(this._cacheChannel){
		this.action.channel_list.call(this,{
			'action': 'channel_list',
			'list': this._cacheChannel.slice()
		},true);
	}else
		this._send({'action': 'channel_list'});
}
AChatClient.prototype.channelSwitch=function(channelId,callback){
	if(!this._checkLogin(callback)) return;
	if(!this._checkId(channelId))
		throw new Error('ChannelId format error.');
	this._send({
		'action': 'channel_switch',
		'channelId': channelId
	});
	callback && this.once('channelSwitch',callback);
}
AChatClient.prototype.channelUserList=function(channelId,callback){
	var cmd={'action': 'channel_userList'};
	if(typeof(channelId)==='function'){
		callback=channelId;
		channelId=undefined;
	}else if(channelId && !this._checkId(channelId)){
		throw new Error('ChannelId format error.');
	}else{
		cmd.channelId=channelId;
	}
	if(!this._checkLogin(callback)) return;
	callback && this.once('channelUserList',callback);
	if(cmd.channelId===this.channelId && this._cacheChannelUserList.size){
		var list=[];
		for(var u of this._cacheChannelUserList)
			list.push(u);
		this.action.channel_userList.call(this,{
			'action': 'channel_userList',
			'status': 'success',
			'channelId': channelId,
			'list': list
		},true);
	}else
		this._send(cmd);
}
AChatClient.prototype.chatSend=function(type,toUserId,msg){
	if(!this._checkLogin() || msg===undefined) return false;
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
	}
	return true;
}
AChatClient.prototype.checkEmail=function(code,callback){
	if(this.httpServer===null)
		throw new Error('httpServer not found');
	this._ajax('post','/v1/mail',{
		'code': code
	},callback);
}
AChatClient.prototype.connect=function(){
	if(this.link) return;
	var _=this;
	var link=this.link=new WebSocket(this.server,'chatv1');
	var connectFail=function(code){
		if(code===1006){
			_.removeListener('close',connectFail)._emit('connect','connection fail');
		}
	}
	this.on('close',connectFail);
	link.addEventListener('close',function(ev){
		_.connected=false;
		_.link=null;
		_.actionGroup=null;
		_.userId=null;
		_.username=null;
		_._cacheChannel=null;
		_._cacheChannelUserList.clear();
		_._question=false;
		
		switch(ev.code){
			case 4101: _._emit('auth',AChatClient.statusCode[4101]); break;
			case 4102: _._emit('auth','fail'); break;
			case 4103: _._emit('auth',AChatClient.statusCode[4103]); break;
		}
		
		if(ev.code===undefined){
			if(_.autoReconnect && _.authData){
				_._emit('close',null,null,true);
				_.connect().authBySession(this.channelList);
			}else
				_._emit('close',null,null,false);
		}else{
			_.authData=null;
			_.channel=null;
			_._emit('close',ev.code,AChatClient.statusCode[ev.code],false);
		}
	});
	link.addEventListener('error',function(error){
		_.error(error);
	});
	link.addEventListener('message',function(data){
		try{
			data=JSON.parse(data.data);
		}catch(e){
			_.error(new Error('用戶端指令解析失敗'));
			return;
		}
		if(typeof(data.action)==='string' && _.action.hasOwnProperty(data.action))
			_.action[data.action].call(_,data);
		else
			_.error(new Error('用戶端指令格式錯誤或'));
	});
	link.addEventListener('open',function(){
		_.connected=true;
		_.removeListener('close',connectFail)._emit('connect',null);
	});
}
AChatClient.prototype.createSession=function(username,password,callback){
	if(!username || !password)
		throw new Error('缺少驗證資料');
	var authData={
		'username': username,
		'password': this._passwordHash(password)
	};
	if(!this.link) this.connect();
	if(this.connected){
		this._createQuestion(function(question){
			this._send({
				'action': 'createSession',
				'username': authData.username,
				'answer': this._passwordHmac(question,authData.password)
			});
		});
	}else{
		this.once('connect',function(error){
			if(error) return;
			this._createQuestion(function(question){
				this._send({
					'action': 'createSession',
					'username': authData.username,
					'answer': this._passwordHmac(question,authData.password)
				});
			});
		});
	}
	callback && this.once('createSession',callback);
}
AChatClient.prototype.editProfile=function(password,profileData,callback){
	if(!this._checkLogin(callback)) return;
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
AChatClient.prototype.error=function(error){
	if(this.event.error.length)
		this._emit('error',error);
	else
		throw error;
}
AChatClient.prototype.forgotPassword=function(email,callback){
	if(this.httpServer===null)
		throw new Error('httpServer not found');
	this._ajax('post','/v1/forgotPassword',{
		'email': email
	},callback);
}
AChatClient.prototype.getProfile=function(userIds,callback){//改為使用者自身以外完全快取
	if(typeof(userIds)==='function'){
		callback=userIds;
		userIds=undefined;
	}
	if(!this._checkLogin(callback)) return;
	if(Array.isArray(userIds)){
		var _=this;
		if(!userIds.every(_._checkId))
			throw new Error('userIds 不合法');
	}else if(userIds===undefined)
		userIds=[this.userId];
	else if(this._checkId(userIds))
		userIds=[userIds];
	else
		throw new Error('userIds 不合法');
	if(callback){
		var _=this;
		var cbCheck=function(status,userId,profile){
			var index=userIds.indexOf(userId);
			if(index===-1) return;
			callback.call(_,status,userId,profile);
			userIds.splice(index,1);
			if(!userIds.length) this.removeListener('getUserProfile',cbCheck);
		};
		this.on('getUserProfile',cbCheck);
	}
	var query=[];
	var u,cu;
	for(u of userIds){
		if(u===this.userId)//論其他用戶端更新 E-mail 的可能性
			query.push(u);
		else if(cu=this._cacheUser.get(u)){//其他使用者的資料都是靜態的，快取全開
			callback && this.action.user_getProfile.call(this,{
				'action': 'user_getProfile',
				'status': 'success',
				'profile': cu
			},true);
		}else
			query.push(u);
	}
	if(query.length) this._send({
		'action': 'user_getProfile',
		'userIds': userIds
	});
	return true;
}
AChatClient.prototype.logout=function(){
	if(!this._checkLogin()) return;
	this._send({
		'action': 'user_logout'
	});
}
AChatClient.prototype.on=function(evName,func){
	if(this.event.hasOwnProperty(evName))
		this.event[evName].push(func);
	return this;
}
AChatClient.prototype.once=function(evName,func){
	if(this.event.hasOwnProperty(evName)){
		var _=this;
		var autoRemove=function(){
			_.removeListener(evName,autoRemove);
			func.apply(_,arguments);
		}
		this.on(evName,autoRemove);
	}
	return this;
}
AChatClient.prototype.register=function(username,email,password,callback){
	if(this.httpServer===null)
		throw new Error('httpServer not found');
	this._ajax('post','/v1/register',{
		'username': username,
		'email': email,
		'password': this._passwordHash(password)
	},callback);
}
AChatClient.prototype.resetPassword=function(code,callback){
	if(this.httpServer===null)
		throw new Error('httpServer not found');
	this._ajax('post','/v1/resetPassword',{
		'code': code
	},callback);
}
AChatClient.prototype.removeListener=function(evName,func){
	var index,event=this.event;
	if(event.hasOwnProperty(evName) && (index=this.event[evName].indexOf(func))!==-1)
		event[evName].splice(index,1);
	return this;
}