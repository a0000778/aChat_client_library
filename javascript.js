/*
aChat Client Library
for JavaScript v1.0.0 by a0000778
Tested on Chrome 42, FireFox 35, Opera 27 and Safari 8
*/

/*
項目						型態			預設值	說明
config.autoReconnect	boolean		true	斷線自衝重連
config.passwordHash		function	(必填)	密碼加密方法
config.server			string		(必填)	伺服器
config.httpServer		string		null	HTTP API伺服器，null則無法使用註冊、忘記密碼等API
*/
function aChatClient(config){
	if(!this.constructor.checkSupport())
		return false;
	config=config || {};
	this.action={};
	this.userId=null;
	this.username=null;
	this.authData=null;
	this.autoReconnect=('autoReconnect' in config)? config.autoReconnect:true;
	this.channel=null;
	this.connected=false;
	this.cacheUser=new Map();
	this.cacheChannel=new Map();
	this.event={
		'error': [],
		/*
		auth args
		- error
		- status:
			- account disabled: 帳號已停用
			- fail: 登入失敗
			- repeat login: 重複登入
			- success: 成功登入
		*/
		'auth': [],
		/*
		channelExit args
		- userId
		*/
		'channelExit': [],
		/*
		channelJoin args
		- userId
		*/
		'channelJoin': [],
		/*
		channelList args
		- error
		- channel list
		*/
		'channelList': [],
		/*
		channelSwitch args
		- error:
			- full: 目標頻道人數已滿
			- not exists: 目標頻道不存在
		- type:
			- default: 切換至預設頻道(所在頻道被刪除、剛連上伺服器時出現)
			- normal: 由用戶端進行的移動
			- force: 由伺服端、管理者強制進行的移動
		- channelId
		*/
		'channelSwitch': [],
		/*
		channelUserList args
		- error
		- channelId
		- userList
		*/
		'channelUserList': [],
		/*
		close args
		- code
		- reason
		- autoReconnect
		*/
		'close': [],
		/*
		connect args
		- error
		*/
		'connect': [],
		/*
		chatGlobal args
		- send time
		- message
		*/
		'chatGlobal': [],
		/*
		chatNormal args
		- send time
		- from user id
		- from username
		- message
		*/
		'chatNormal': [],
		/*
		chatNotice args
		- send time
		- message
		*/
		'chatNotice': [],
		/*
		chatPrivate args
		- send time
		- from user id
		- from username
		- to user id
		- to username
		- message
		*/
		'chatPrivate': [],
		/*
		getUserProfile args
		- error
		- userId
		- result (string or object)
		*/
		'getUserProfile': [],
		/*
		editUserProfile args
		- status
		*/
		'editUserProfile': []
	}
	this.link=null;
	this.passwordHash=config.passwordHash;
	this.server=config.server;
	this.httpServer=config.httpServer || null;
	
	var action,actionDefault=this.constructor.action;
	for(action in actionDefault){
		this.action[action]=actionDefault[action];
	}
}
aChatClient.action={
	'auth': function(data){
		if(data.status=='success' && /^\d$/.test(data.userId) && data.userId>0){
			this.userId=parseInt(data.userId,10);
			this.getProfile(this.userId,function(error,userId,profile){
				if(!error && userId===this.userId)
					this.username=profile.username;
				this.emit('auth',null,'success');
			});
		}
	},
	'channel_exit': function(data){
		this.emit('channelExit',data.userId);
	},
	'channel_join': function(data){
		this.emit('channelJoin',data.userId);
	},
	'channel_list': function(data){
		data.list.forEach(function(ch){
			this.cacheChannel.set(ch.channelId,ch);
		},this);
		this.emit('channelList',null,data.list);
	},
	'channel_switch': function(data){
		if(data.status=='success' || data.status=='force'){
			this.channel=data.channelId;
			this.emit('channelSwitch',null,data.status=='force'? 'force':'normal',data.channelId);
		}else{
			this.emit('channelSwitch',data.status,data.status=='force'? 'force':'normal',data.channelId);
		}
	},
	'channel_userList': function(data){
		if(data.status=='success')
			this.emit('channelUserList',null,data.channelId,data.userList || []);
		else
			this.emit('channelUserList',data.status,data.channelId);
	},
	'chat_global': function(data){
		this.emit('chatGlobal',data.time,data.msg);
	},
	'chat_normal': function(data){
		if(this._checkId(data.fromUserId) && typeof(data.msg)=='string'){
			if(this.cacheUser.has(data.formUserId))
				this.emit('chatNormal',data.time,data.fromUserId,this.cacheUser.get(data.fromUserId).username,data.msg);
			else{
				this.getProfile(data.fromUserId,function(error,userId,profile){
					this.emit(
						'chatNormal',
						data.time,
						data.fromUserId,
						error? null:profile.username,
						data.msg
					);
				});
			}
		}
	},
	'chat_notice': function(data){
		this.emit('chatNotice',data.time,data.msg);
	},
	'chat_private': function(data){
		if(this._checkId(data.fromUserId) && this._checkId(data.toUserId) && typeof(data.msg)=='string'){
			var findUsername=[];
			this.cacheUser.has(data.fromUserId) || findUsername.push(data.fromUserId);
			this.cacheUser.has(data.toUserId) || findUsername.push(data.toUserId);
			if(findUsername.length){
				this.getProfile(findUsername,function(error,userId){
					findUsername.splice(findUsername.indexOf(userId),1);
					if(!findUsername.length)
						this.emit('chatPrivate',data.time,data.fromUserId,this.cacheUser.get(data.fromUserId).username,data.toUserId,this.cacheUser.get(data.toUserId).username,data.msg);
				});
			}else
				this.emit('chatPrivate',data.time,data.fromUserId,this.cacheUser.get(data.fromUserId).username,data.toUserId,this.cacheUser.get(data.toUserId).username,data.msg);
		}
	},
	'user_getProfile': function(data){
		if(data.status='success'){
			this.cacheUser.set(data.profile.userId,data.profile);
			this.emit('getUserProfile',null,data.profile.userId,data.profile);
		}else
			this.emit('getUserProfile',data.status,data.profile.userId,data.profile);
	},
	'user_editProfile': function(data){
		if('status' in data)
			this.emit('editUserProfile',data.status);
	}
}
aChatClient.checkSupport=function(){
	return ('WebSocket' in window) && ('Map' in window);
}
aChatClient.statusCode={
	1000: 'logout',
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
aChatClient.prototype._ajax=function(method,path,data,callback){
	var xhr=new XMLHttpRequest();
	xhr.addEventListener('error',function(e){
		callback(e);
	});
	xhr.addEventListener('load',function(e){
		callback(xhr.responseText);
	});
	xhr.open(method,this.httpServer+path);
	xhr.setRequestHeader('Content-Type', 'application/json');
	xhr.send(JSON.stringify(data));
}
aChatClient.prototype._checkLogin=function(callback){
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
aChatClient.prototype._checkId=(function(){
	var reg=/^\d+$/;
	return function(id){
		return (typeof(id)=='number' && reg.test(id) && id>0);
	}
})();
aChatClient.prototype._send=function(data){
	if(this.link){
		this.link.send(JSON.stringify(data));
		return true;
	}
	return false;
}
aChatClient.prototype.auth=function(username,password){
	if(username!==undefined && password!==undefined){
		this.authData={
			'username': username,
			'password': this.passwordHash(password)
		};
	}else if(!this.authData){
		this.error(new Error('缺少驗證資料'));
		return;
	}
	if(!this.link) this.connect();
	if(this.connected){
		this._send({
			'action': 'auth',
			'username': this.authData.username,
			'password': this.authData.password
		});
		if(!this.autoReconnect)
			this.authData=null;
	}else{
		this.once('connect',function(){
			this._send({
				'action': 'auth',
				'username': this.authData.username,
				'password': this.authData.password
			});
			if(!this.autoReconnect)
				this.authData=null;
		});
	}
}
aChatClient.prototype.channelList=function(callback){
	if(!this._checkLogin(callback)) return;
	this._send({'action': 'channel_list'});
	callback && this.once('channelList',callback);
}
aChatClient.prototype.channelSwitch=function(channelId,callback){
	if(!this._checkLogin(callback)) return;
	if(!/^\d+$/.test(channelId)){
		this.error(new Error('ChannelId format error.'));
		return;
	}
	this._send({
		'action': 'channel_switch',
		'channelId': parseInt(channelId,10)
	});
	callback && this.once('channelSwitch',callback);
}
aChatClient.prototype.channelUserList=function(channelId,callback){
	var cmd={'action': 'channel_userList'};
	if(typeof(channelId)==='function'){
		callback=channelId;
		channelId=undefined;
	}else if(/^\d+$/.test(channelId) && channelId>0){
		cmd.channelId=channelId;
	}
	if(!this._checkLogin(callback)) return;
	this._send(cmd);
	callback && this.once('channelUserList',callback);
}
aChatClient.prototype.chatSend=function(type,toUserId,msg){
	if(!this._checkLogin() || msg===undefined) return false;
	msg=msg.toString();
	if(msg.length===0) return false;
	if(type=='normal'){
		this._send({
			'action': 'chat_normal',
			'msg': msg
		});
	}else if(type=='private' && /^\d+$/.test(toUserId) && toUserId>0){
		this._send({
			'action': 'chat_private',
			'toUserId': parseInt(toUserId,10),
			'msg': msg
		});
	}
	return true;
}
aChatClient.prototype.checkEmail=function(code,callback){
	if(this.httpServer===null){
		callback('httpServer not found');
		return;
	}
	this._ajax('post','/v1/mail',{
		'code': code
	},callback);
}
aChatClient.prototype.connect=function(){
	var _=this;
	var link=this.link=new WebSocket(this.server,'chatv1');
	link.addEventListener('close',function(ev){
		_.connected=false;
		_.link=null;
		_.userId=null;
		_.username=null;
		switch(ev.code){
			case 4101: _.emit('auth',null,'account disabled'); break;
			case 4102: _.emit('auth',null,'fail'); break;
			case 4103: _.emit('auth',null,'repeat login'); break;
		}
		
		if(ev.code===undefined){
			if(_.autoReconnect && _.authData){
				_.emit('close',null,null,true);
				_.connect().auth();
			}else
				_.emit('close',null,null,false);
		}else{
			_.authData=null;
			_.channel=null;
			_.emit('close',ev.code,aChatClient.statusCode[ev.code]);
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
		_.emit('connect',null);
	});
}
aChatClient.prototype.emit=function(evName){//evName,arg1,arg2...
	if(this.event.hasOwnProperty(evName)){
		var args=Array.prototype.slice.call(arguments,1);
		this.event[evName].forEach(function(func){
			func.apply(this,args);
		},this);
	}
}
aChatClient.prototype.error=function(error){
	if(this.event.error.length)
		this.emit('error',error);
	else
		throw error;
}
aChatClient.prototype.forgotPassword=function(email,callback){
	if(this.httpServer===null){
		callback('httpServer not found');
		return;
	}
	this._ajax('post','/v1/forgotPassword',{
		'email': email
	},callback);
}
aChatClient.prototype.logout=function(){
	if(!this._checkLogin()) return;
	this._send({
		'action': 'user_logout'
	});
}
aChatClient.prototype.on=function(evName,func){
	if(this.event.hasOwnProperty(evName))
		this.event[evName].push(func);
	return this;
}
aChatClient.prototype.once=function(evName,func){
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
aChatClient.prototype.getProfile=function(userIds,callback){
	if(typeof(userIds)==='function'){
		callback=userIds;
		userIds=undefined;
	}
	if(!this._checkLogin(callback)) return;
	if(Array.isArray(userIds)){
		var _=this;
		if(!userIds.reduce(function(result,userId){
			return result && _._checkId(userId);
		},true)){
			this.error(new Error('userIds 不合法'));
			return false;
		}
	}else if(userIds===undefined){
		userIds=[this.userId];
	}else if(this._checkId(userIds)){
		userIds=[userIds];
	}else{
		this.error(new Error('userIds 不合法'));
		return false;
	}
	this._send({
		'action': 'user_getProfile',
		'userIds': userIds
	});
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
	return true;
}
aChatClient.prototype.editProfile=function(profileData,callback){
	if(!this._checkLogin(callback)) return;
	if(typeof(profileData)=='object'){
		if(typeof(profileData.password)=='string' && profileData.password.length>=32){
			var sendData={'action': 'user_editProfile'};
			for(var field in profileData){
				if(field=='action'){
					this.emit('error',new Error('profile 不支援 action 欄位'));
					return;
				}
				sendData[field]=profileData[field];
			}
			sendData.password=this.passwordHash(sendData.password);
			this._send(sendData);
			callback && this.once('editUserProfile',callback);
		}else{
			this.emit('error',new Error('修改資料需要 password 欄位'));
		}
	}
}
aChatClient.prototype.register=function(username,email,password,callback){
	if(this.httpServer===null){
		callback('httpServer not found');
		return;
	}
	this._ajax('post','/v1/register',{
		'username': username,
		'email': email,
		'password': this.passwordHash(password)
	},callback);
}
aChatClient.prototype.resetPassword=function(code,callback){
	if(this.httpServer===null){
		callback('httpServer not found');
		return;
	}
	this._ajax('post','/v1/resetPassword',{
		'code': code
	},callback);
}
aChatClient.prototype.removeListener=function(evName,func){
	var index,event=this.event;
	if(event.hasOwnProperty(evName) && (index=this.event[evName].indexOf(func))!==-1)
		event[evName].splice(index,1);
	return this;
}