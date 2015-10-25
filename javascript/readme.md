# aChat Client Library for JavaScript
aChat 聊天室瀏覽器用戶端函式庫說明文件
對應函式庫版本 v1.0.0-beta

## 授權
by a0000778
MIT Licence

## 執行環境
已經於以下環境測試通過

* Chrome 46
* FireFox 41

## 引用函式庫
* CryptoJS (https://code.google.com/p/crypto-js): MD5, SHA256, Hmac 演算法

## 事件
### auth
驗證結果

* `status` (String)
	* `account disabled` 帳號已停用
	* `fail` 登入失敗
	* `success` 成功登入

### channelExit
有使用者離開所在頻道

* `userId` (Number)
* `username` (String)

### channelJoin
有使用者加入所在頻道

* `userId` (Number)
* `username` (String)

### channelList
當前頻道列表

* `channelList` (Array)
	* `channel` (Object)
		* `channelId` (Number)
		* `name` (String)

### channelSwitch
頻道切換

* `status` (String)
	* `default` 切換至預設頻道(所在頻道被刪除、剛連上伺服器時出現)
	* `force` 由伺服端、管理者強制進行的移動
	* `full` 由用戶端進行的移動，但目標頻道人數已滿
	* `normal` 由用戶端進行的移動
	* `not exists` 由用戶端進行的移動，但目標頻道不存在
* `channelId` (Number)
* `channelName` (String)

### channelUserList
頻道使用者列表

* `error` (Undefined or String)
* `channelId` (Number)
* `userList` (Array)
	* (Object)
		* `userId` (Number)
		* `username` (String)

### chatGlobal
廣播訊息

* `sendTime` (Date) 發送時間
* `message` (String) 發送內容

### chatLogQuery
聊天記錄查詢結果

* `messages` (Array)
	* (Object)
		* `messageId` (Number) 訊息編號
		* `time` (Date) 發送時間
		* `fromUserId` (Number) 發送者 userId
		* `toUserId` (Number or Null) 接收者 userId，無特定對象則為 Null
		* `channelId` (Number or Null) 頻道 ID，密頻或全伺服器廣播則為 Null
		* `type` (String) 發言類型
			* `normal` 一般
			* `private` 密頻
			* `global` 廣播
		* `message` (String) 發言內容

### chatNormal
一般訊息

* `sendTime` (Date) 發送時間
* `fromUserId` (Number) 發送者使用者編號
* `fromUsername` (String) 發送者名稱
* `message` (String) 發送內容

### chatNotice
提示訊息

* `sendTime` (Date) 發送時間
* `message` (String) 發送內容 

### chatPrivate
私人訊息

* `sendTime` (Date) 發送時間
* `fromUserId` (Number) 發送者使用者編號
* `fromUsername` (String) 發送者名稱
* `toUserId` (Number) 發送目標使用者編號
* `toUsername` (String) 發送目標名稱
* `message` (String) 發送內容

### close
連線中斷

* `code` (Number)
* `reason` (String) 中斷原因
* `autoReconnect` (Boolean) 是否進行自動重連

### connectFail
連線失敗

### createSession
建立 Session

* `userId` (Number)
* `session` (Hex)

### editUserProfile
修改資料結果

* `status` (String)
	* `success`
	* `auth fail`

### error
發生錯誤，不包含設定、調用這類程式開發的錯誤

* `error` (Error)

### getUserProfile
查詢使用者資料結果

* `status` (String)
	* `success`
	* `fail`
* `userId` (Number)
* `result` (Object)
	* `userId` (Number) 查詢失敗時，僅有此項目
	* `username` (String)
	* `email` (String) 僅限於查詢自己的資料時輸出
	* `regTime` (Number) 註冊時間，Unix Time(ms)

### inited
載入完畢

* `error` (Error or Undefined) 載入時發生的錯誤

### listSession
當前存在的 Session 列表

* `sessions` (Array)
	* (Object)
		* `session` (String) Session
		* `createTime` (Date) 建立時間
		* `lastClient` (String) 最後使用的用戶端
		* `lastLogin` (Date) 最後登入時間
		* `online` (Boolean) 當前是否在線

### needOnline
需要網路時觸發

### offline
離線

* `logout` (Boolean) 是否為登出
* `autoReconnect` (Boolean) 是否自動重連
* `reason` (String) 離線原因

### online
已上線

### removeSession
刪除 Session

* `session` (String) 刪除目標
* `status` (String) 刪除結果
	* `removed` 刪除成功
	* `now session` 為當前 session，不可刪除(請使用登出進行刪除)

### sendClient
收到來自同使用者任意用戶端的訊息

* `from` (String) 來自 Session
* `data` (Mixed) 訊息內容，型態由發送端決定

## 靜態變數
### AChatClient.statusCode.*
狀態碼意義

### AChatClient.version
函式庫版本

## 靜態 API
### new AChatClient(config)
新增 AChatClient 物件，瀏覽器不支援則返回false。

* `config` (Object) 設定
* `config.autoReconnect` (Boolean) 斷線自衝重連，預設為 true
* `config.wsServer` (String) WebSocket 伺服器位址，像是 `ws://127.0.0.1:9700`，必填
* `config.httpServer` (String) HTTP API 伺服器，像是 `http://127.0.0.1:9700`，null 則無法使用註冊、忘記密碼等 API，預設為 null
* `config.keyPrefix` (String) localStorage 資料儲存鍵值字首

### AChatClient.checkSupport()
檢查瀏覽器支援，返回 Boolean。

## 物件變數
### action.*
對應伺服器指令執行腳本，可依需求自定義，預設參照靜態 `AChatClient.action` 變數。

* `data` (Object) 輸入的資料
* `vEmit` (Boolean) 模擬觸發，表示輸入資料源自快取

### wsServer
等同設定 `config.wsServer`，只讀

### httpServer
等同設定 `config.httpServer`，只讀

### autoReconnect
等同設定 `config.autoReconnect`

### keyPrefix
等同設定 `config.keyPrefix`，只讀

### actionGroup
當前登入者的指令集名稱，未登入為 `null`

### channelId
當前登入者所在頻道的 ID，未登入為 `null`

### userId
當前登入者的 ID，未登入為 `null`

### username
當前登入者的名稱，未登入為 `null`

### canAutoAuth
是否可以使用儲存的驗證資料進行驗證

### connected
是否已經建立連線

## 物件 API
### authBySession(userId,session,callback)
以 Session 驗證

* `userId` (Number) 帳號編號
* `session` (String) 屬於該帳號的 Session
* `callback` (Function,選擇性) 返回結果，參數見事件 auth

### authByPassword(username,password,callback)
以密碼產生 Session，並以該 Session 驗證

* `username` (String) 帳號
* `password` (String) 密碼
* `callback` (Function,選擇性) 返回結果，參數見事件 auth

### channelList(callback)
取得頻道列表

* `callback` (Function,選擇性) 返回結果，參數見事件 channelList

### channelSwitch(channelId,callback)
切換頻道

* `channelId` (Number) 目標頻道 ID
* `callback` (Function,選擇性) 返回結果，參數見事件 channelSwitch

### channelUserList(channelId,callback)
取得頻道使用者列表

* `channelId` (Number) 目標頻道 ID
* `callback` (Function,選擇性) 返回結果，參數見事件 channelUserList

### chatSend(type,toUserId,msg)
發送訊息

* `type` (String) 訊息類型
	* `normal` 一般
	* `private` 密頻
* `toUserId` (Number) 發送目標，僅密頻有效
* `msg` (String) 訊息

### chatLogQuery(filter,callback)
查詢聊天記錄

* filter (Object) 條件過濾
	* `type` (String) 查詢類型
		* `public` 公開訊息，包含公告、公開聊天訊息
		* `private` 私人訊息，包含密頻、管理員密頻
	* `channelId` (Number,選擇性) 查詢頻道，查詢類型為 `public` 時有效
	* `startTime` (Date,選擇性) 查詢在此之後發送的訊息
	* `endTime` (Date,選擇性) 查詢在此之前發送的訊息
	* `startMessageId` (Number,選擇性) 查詢在此編號之後的訊息
	* `limit` (Number,選擇性) 查詢結果數量限制，預設 100，最大 500
* `callback` (Function,選擇性) 返回結果，附帶查詢過濾，參數見事件 chatLogQuery

### checkEmail(code,callback)
驗證信箱

* `code` (String) 驗證代碼
* `callback` (Function) 返回結果
	* `error` (Error or Undefined) 錯誤
	* `result` (String) 結果
		* `OK` 成功
		* `username` 帳號重複(僅註冊時使用)
		* `email` E-mail重複
		* `not exists` 代碼不存在

### editProfile(password,profileData,callback)
修改帳號資料

* `password` (String) 當前密碼
* `profileData` (Object) 修改內容
	* `email` (String,選擇性) 信箱
	* `password` (String,選擇性) 密碼
* `callback` (Function,選擇性) 返回結果，參數見事件 editUserProfile

### forgotPassword(email,callback)
忘記密碼，將發送密碼重設確認信，信中包含的重設碼代入 resetPassword API 使用

* `email` (String) 信箱
* `callback` (Function) 返回結果
	* `error` (Error or Undefined) 錯誤
	* `result` (String) 結果，必為空字串

### getProfile(userIds,callback)
取得帳號資料

* `userId` (Number) 目標帳號編號
* `callback` (Function,選擇性) 返回結果，包含 userId 過濾，參數見事件 getUserProfile

### listSession(callback)
* `callback` (Function,選擇性) 返回結果，參數見事件 listSession

### logout()
登出，並刪除 Session 及登入資訊

### on(evName,func)
新增事件監聽

* `evName` (String) 事件名稱
* `func` (Function)	觸發函式

### once(evName,func)
新增一次性事件監聽

* `evName` (String) 事件名稱
* `func` (Function)	觸發函式

### register(username,email,password,callback)
註冊

* `username` (String) 帳號、名稱
* `email` (String) 信箱
* `password` (String) 密碼
* `callback` (Function) 返回結果
	* `error` (Error or Undefined) 錯誤
	* `result` (String) 結果
		* `OK` 成功
		* `username` 帳號、名稱重複
		* `email` E-mail重複

### resetPassword(code,callback)
重設密碼，若重設成功將發送新密碼至信箱

* `code` (String) 重設代碼
* `callback` (Function) 返回結果
	* `error` (Error or Undefined) 錯誤
	* `result` (String) 結果
		* `OK` 成功
		* `not exists` 代碼不存在

### removeListener(evName,func)
移除事件監聽

* `evName` (String) 事件名稱，未填則刪除所有事件的觸發函式
* `func` (Function)	觸發函式，未填則刪除該事件下所有觸發函式

### removeSession(targetSession,callback)
刪除 Session

* `targetSession` (String) 刪除目標 Session
* `callback` (Function,選擇性) 返回結果，參數見事件 removeSession

### sendClient(data,toSession)
發送訊息給同使用者任意用戶端

* `data` (Mixed) 訊息內容
* `toSession` (String,選擇性) 發送目標，未定義則發送給同使用者所有用戶端

## 內部事件
這些事件僅提供函式庫內部自行調用，一般使用者可以跳過。

### _connect
連線已建立

### _question
當前 Hmac 驗證方法的問題

## 內部 API
這些 API 僅提供函式庫內部自行調用，或者由擴充功能調用，一般使用者可以跳過。

### _ajax(method,path,data,callback)
發起 XMLHttpRequest 請求

### _checkId()
檢查是否符合編號格式

### _checkLogin()
檢查當前是否已連線登入

### _checkOnline(needOnline)
檢查當前是否已連上網路

### _clearCache()
清理過期快取

### _clearStatus()
清空使用者登入狀態

### _connect()
建立連線

### _createQuestion(callback)
產生 Hmac 驗證方法的問題

### _debug(...)
除錯訊息輸出

### _emit(evName,arg1,arg2,...)
觸發事件

### _error(error)
觸發錯誤

### _passwordHash(password)
密碼 Hash 方法，調用 CryptoJS 函式庫實現，目前採用 SHA256 算法

### _passwordHmac(question,password)
Hmac 驗證方法答案，調用 CryptoJS 函式庫實現，目前採用 SHA256 算法

### _send(data)
發送訊息給伺服端
