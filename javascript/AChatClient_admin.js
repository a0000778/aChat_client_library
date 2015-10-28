/*
aChat Client Library
for JavaScript v1.0.0-beta
Admin plugin v0.0.1
by a0000778
*/
(function(AChatClient){
AChatClient.pluginInit.push(function(onLoad){
	this._admin_execing=new Set();
	onLoad();
});
AChatClient.action.admin_channel_create=function(data){
	this._admin_execing.delete('admin_channel_create');
	this._emit('admin_channelCreate',data.status);
}
AChatClient.action.admin_channel_delete=function(data){
	this._admin_execing.delete('admin_channel_delete');
	this._emit('admin_channelDelete',data.status);
}
AChatClient.action.admin_channel_edit=function(data){
	this._admin_execing.delete('admin_channel_edit');
	this._emit('admin_channelEdit',data.status);
}
AChatClient.action.admin_user_kick=function(data){
	
}
AChatClient.action.admin_user_ban=function(data){
	
}
AChatClient.action.admin_user_unban=function(data){
	
}
AChatClient.action.admin_chat_global=function(data){
	this._admin_execing.delete('admin_chat_global');
	this._emit('admin_chatGlobal',data.status);
}
AChatClient.prototype.admin_channelCreate=function(channelName,callback){
	if(this.actionGroup!='Admin') return;
	if(typeof(channelName)!='string' || !channelName){
		this._error(new Error('channelName 必須為字串且不為空！'));
		return;
	}
	if(this._admin_execing.has('admin_channel_create')){
		var nextExec=function(){
			if(this._admin_execing.has('admin_channel_create')) return;
			this.removeListener('admin_channelCreate',nextExec);
			this.admin_channelCreate(channelName,callback);
		}
		this.on('admin_channelCreate',nextExec);
	}else{
		callback && this.once('admin_channelCreate',callback);
		this._admin_execing.add('admin_channel_create');
		this._send({
			'action': 'admin_channel_create',
			'name': channelName
		});
	}
}
AChatClient.prototype.admin_channelDelete=function(channelId,callback){
	if(this.actionGroup!='Admin') return;
	if(!this._checkId(channelId)){
		this._error(new Error('channelId 必須為大於0的整數！'));
		return;
	}
	if(this._admin_execing.has('admin_channel_delete')){
		var nextExec=function(){
			if(this._admin_execing.has('admin_channel_delete')) return;
			this.removeListener('admin_channelDelete',nextExec);
			this.admin_channelDelete(channelName,callback);
		}
		this.on('admin_channelDelete',nextExec);
	}else{
		callback && this.once('admin_channelDelete',callback);
		this._admin_execing.add('admin_channel_delete');
		this._send({
			'action': 'admin_channel_delete',
			'channelId': channelId
		});
	}
}
AChatClient.prototype.admin_channelEdit=function(channelId,newChannelName,callback){
	if(this.actionGroup!='Admin') return;
	if(!this._checkId(channelId)){
		this._error(new Error('channelId 必須為大於0的整數！'));
		return;
	}
	if(typeof(newChannelName)!='string' || !newChannelName){
		this._error(new Error('newChannelName 必須為字串且不為空！'));
		return;
	}
	if(this._admin_execing.has('admin_channel_edit')){
		var nextExec=function(){
			if(this._admin_execing.has('admin_channel_edit')) return;
			this.removeListener('admin_channelEdit',nextExec);
			this.admin_channelEdit(channelName,callback);
		}
		this.on('admin_channelEdit',nextExec);
	}else{
		callback && this.once('admin_channelEdit',callback);
		this._admin_execing.add('admin_channel_edit');
		this._send({
			'action': 'admin_channel_edit',
			'channelId': channelId,
			'name': newChannelName
		});
	}
}
AChatClient.prototype.admin_chatGlobal=function(type,msg,target,callback){
	if(this.actionGroup!='Admin') return;
	if(type=='global'){
		if(typeof(msg)!='string' || !msg){
			this._error(new Error('msg 必須為字串且不為空！'));
			return;
		}
		if(typeof(target)=='function'){
			callback=target;
			target=undefined;
		}
	}else if(type=='channel' || type=='user'){
		if(!this._checkId(target)){
			this._error(new Error('target 必須為大於0的整數！'));
			return;
		}
	}else{
		this._error(new Error('type 必須為 global, channel, user 其中之一！'));
		return;
	}
	if(this._admin_execing.has('admin_chat_global')){
		var nextExec=function(){
			if(this._admin_execing.has('admin_chat_global')) return;
			this.removeListener('admin_chatGlobal',nextExec);
			this.admin_chatGlobal(type,msg,target,callback);
		}
		this.on('admin_chatGlobal',nextExec);
	}else{
		callback && this.once('admin_chatGlobal',callback);
		var cmd={
			'action': 'admin_chat_global',
			'msg': msg
		};
		if(type=='channel') cmd.channelId=target;
		else if(type=='user') cmd.userId=target;
		this._send(cmd);
	}
}
AChatClient.prototype.admin_userKick=function(userId,callback){
	if(this.actionGroup!='Admin') return;
	
}
AChatClient.prototype.admin_userBan=function(userId,callback){
	if(this.actionGroup!='Admin') return;
	
}
AChatClient.prototype.admin_userUnban=function(userId,callback){
	if(this.actionGroup!='Admin') return;
	
}
})(AChatClient);