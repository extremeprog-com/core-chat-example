
Core.registerEventPoint('ChatUser_ClickedSendMessage');
Core.registerRequestPoint('ChatUser_NewMessageRq');
Core.registerRequestPoint('ChatUser_MessageListRq');

Core.registerEventPoint  ('Chat_MessageListUpdated');

Core.registerEventPoint('ChatWsLink_ConnectionOpened');

ChatUser = {
  createSendMessageRequest: function() {
    CatchEvent(ChatUser_ClickedSendMessage);
    
    FireRequest(new ChatUser_NewMessageRq({
      user: document.getElementById('username').value,
      message: document.getElementById('message').value
    }));
  },
  requestMessageList: function() {
    CatchEvent(ChatWsLink_ConnectionOpened);
    
    FireRequest(new ChatUser_MessageListRq(), function() {
      // здесь можно ничего не делать, на самом деле, потому что ответ продублируется еще и событием ChatUser_MessageListRq_Success
    });
  },
  showMessageList: function() {
    var event = CatchEvent(Chat_MessageListUpdated, ChatUser_MessageListRq_Success);
    // показываем список сообщений, если пришел ответ на ChatUser_MessageListRq
    // и на любое изменение этого списка
    
    console.log(event);
    
    var messagesTxt = (event.currentMessageList || event.result.messageList).map(it=>`${it.date} - ${it.user}: ${it.message}`).join("\n\n");
    
    document.getElementById('messageListElement').innerText = messagesTxt;
  }
  
};



ChatWsLink = {
  // задача и обязанность этого модуля – организовать клиент-серверное взаимодейтсиве.
  // работать будем просто – сами мничего не делаем, просто перенаправляем эвенты и реквесты

  Init: new Core.EventPoint(), // декларируем эвент "модуль инициализируется", вызовется автоматически при инициализации объекта
  
  ws: null,
  
  s_cb: {},
  
  initAndReceiveEvents: function() {
    CatchEvent(ChatWsLink.Init); // вызовется автоматически, когда произойдет эвент "модуль инициализируется"
    
    var ws = new WebSocket('ws://' + location.host + '/chat_ws');
    this.ws = ws;
  
    ws.addEventListener('open', (event) => {
      FireEvent(new ChatWsLink_ConnectionOpened);
      
      // dirty hack – ping every second
      setInterval(() => {
        this.ws.send('ok');
      }, 1000)
    });
  
    ws.addEventListener('message', function (event) {
      var msg = event.data;
  
      try {
        // десериализуем
        var msg_obj = JSON.parse(msg)
      } catch(e) {
        // если ошибка - пишем в консоль и игнорируем
        console.warn(e, msg);
        return
      }
      
      console.log(msg_obj);
  
      // простейший код, который прокидывает эвенты и реквесты из клиент-сайда на сервер-сайд
      // безопасность не прикручиваю – можно потом докрутить
      if(msg_obj._event) {
        if(msg_obj._event._reqid) {
          // это пришел ответ на реквест в виде эвента
          ChatWsList.s_cb[request._reqid](msg_obj);
        } else {
          FireEvent(new window[msg_obj._event](msg_obj))
        }
      }
      if(msg_obj._request) {
        FireRequest(msg_obj)
      }
    });
    
  },
  sendRequests: function() {
    var request = CatchRequest(ChatUser_MessageListRq, ChatUser_NewMessageRq);
    request._reqid = Math.random();
    this.ws.send(JSON.stringify(request));
    return function(success, fail) {
      ChatWsLink.s_cb[request._reqid] = success;
    }
  },
};



Core.processGlobal(); // просто вызов, чтобы включить все объекты в контекст и начать работу