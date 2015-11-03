# 事件
## admin_channelCreate
新增頻道操作結果

* `status` (String) 操作結果
	* `success` 新增成功

## admin_channelDelete
刪除頻道操作結果

* `status` (String) 操作結果
	* `success` 刪除成功
	* `not exists` 刪除目標不存在
	* `default channel` 刪除目標為預設頻道
	* `default channel not exists` 預設頻道不存在，無法進行頻道刪除動作

## admin_channelEdit
修改頻道名稱操作結果

* `status` (String) 操作結果
	* `success` 修改成功
	* `not exists` 修改目標不存在

## admin_chatGlobal
廣播操作結果

* `status` (String) 操作結果
	* `success` 成功
	* `fail` 失敗，目標不存在、不在線

## admin_userBan
封鎖使用者操作結果

* `status` (String) 操作結果
	* `success` 成功
	* `not exists` 目標不存在

## admin_userKick
將使用者踢下線操作結果

* `status` (String) 操作結果
	* `success` 成功
	* `not exists` 目標不在線

## admin_userUnban
解鎖使用者操作結果

* `status` (String) 操作結果
	* `success` 成功
	* `not exists` 目標不存在

# 物件 API
## admin_channelCreate(channelName,callback)
新增頻道

* `channelName` (String) 新增頻道名稱
* `callback` (Function,選擇性) 返回結果，附帶操作目標過濾

## admin_channelDelete(channelId,callback)
刪除頻道

* `channelId` (Number) 目標頻道 channelId
* `callback` (Function,選擇性) 返回結果，附帶操作目標過濾

## admin_channelEdit(channelId,newChannelName,callback)
修改頻道名稱

* `channelId` (Number) 目標頻道 channelId
* `newChannelName` (String) 新頻道名稱
* `callback` (Function,選擇性) 返回結果，附帶操作目標過濾

## admin_chatGlobal(type,msg,target,callback)
廣播

* `type` (String) 目標類型
	* `global` 全伺服器
	* `channel` 特定頻道
	* `user` 特定使用者
* `msg` (String) 訊息內容
* `target` (Number) 發送目標 channelId 或者 userId，目標為全伺服器的情況下忽略
* `callback` (Function,選擇性) 返回結果，附帶操作目標過濾

## admin_userBan(userId,callback)
封鎖使用者

* `userId` (Number) 目標 userId
* `callback` (Function,選擇性) 返回結果，附帶操作目標過濾

## admin_userKick(userId,callback)
將使用者踢下線

* `userId` (Number) 目標 userId
* `callback` (Function,選擇性) 返回結果，附帶操作目標過濾

## admin_userUnban(userId,callback)
解鎖使用者

* `userId` (Number) 目標 userId
* `callback` (Function,選擇性) 返回結果，附帶操作目標過濾
