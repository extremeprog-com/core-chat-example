Core = require ('core-os');

Core.registerRequestPoint('HttpEndpoint_NewClient');

Core.registerRequestPoint('ChatUser_MessageListRq');
Core.registerRequestPoint('ChatUser_NewMessageRq');
Core.registerEventPoint  ('Chat_MessageListUpdated');



HttpEndpoint = {
  expressApp: null,
  wsUsers: [],
  
  Init: new Core.EventPoint(), // декларируем эвент "модуль инициализируется", вызовется автоматически при инициализации объекта
  
  initExpressApp() {
    CatchEvent(HttpEndpoint.Init); // вызовется автоматически, когда произойдет эвент "модуль инициализируется"
  
    var express = require('express');
    this.expressApp = express();

    var expressWsModule = require('express-ws')(this.expressApp);
    this.expressApp.use(express.static('.'));
    this.expressApp.ws( '/chat_ws',
      (ws, req) => {
        this.wsUsers.push(ws);
        
        FireEvent(new HttpEndpoint_NewClient({ ws: ws }));
        
        ws.on('message', (msg) => {
          try {
            // десериализуем
            var msg_obj = JSON.parse(msg)
          } catch(e) {
            // если ошибка - пишем в консоль и игнорируем
            // console.warn(e, msg);
            return
          }
  
          console.log(msg_obj);
  
          // простейший код, который прокидывает эвенты и реквесты из клиент-сайда на сервер-сайд
          // безопасность не прикручиваю – можно потом докрутить
          if(msg_obj._event) {
            FireEvent(msg_obj)
          }
          if(msg_obj._request) {
            FireRequest(new global[msg_obj._request](msg_obj));
          }
        });
        ws.on('close', () => {
          this.wsUsers.splice();
        });
      }
    );
  
    this.expressApp.listen(3000);
  
  },
  sendChatUpdates() {
    var event = CatchEvent(Chat_MessageListUpdated, ChatUser_MessageListRq_Success);
  
    // вообще не заморачиваемся, просто посылаем уже готовый сформированный эвент. что внутри нас не особо интересует.
    
    console.log(event);
    
    this.wsUsers.map(it => {
      try {
        it.send(JSON.stringify(event))
      } catch(e) {
        console.warn(e);
      }
    });
  }
};




Chat = {
  messageList: [],
  addMessageToList: function() {
    var request = CatchRequest(ChatUser_NewMessageRq);
    
    console.log(request);
    
    this.messageList.push({
      user: request.user,
      message: request.message,
      date: new Date().toISOString()
    });
  
    // когда поменялось состояние – просто зафиксируем это с помощью эвента.
    // при этом этому кусочку сода совсем необязательно знать, кто и когда будет использовать это событие
    // то есть, модуль остается чистым, и не знает с чем взаимосвязан
    FireEvent(new Chat_MessageListUpdated({currentMessageList: this.messageList}));
  },
  trimMessageList: function() {
    CatchEvent(Chat_MessageListUpdated);
    // демонстрация, как круто можно делать модульное поведение. закомментировал метод – и поведение trimMessageList исчезло
    // это поведение не смешано ни с какими другими частями системы – не нужно искать место в контроллере или можели, где это сделать
    // также обрати внимание на то, как четко и красиво называются все методы. каждый кусочек кода имеет строгую
    // обязанность, обязанности не размыты и не пересекаются
    if(this.messageList.length > 10) {
      this.messageList.splice(10)
    }
  },
  getMessageList: function() {
    var request = CatchRequest(ChatUser_MessageListRq);
    // отвечаем на реквест – тут немного устаревший синтаксис, в будущем будет проще
    return function(success, fail) {
      success({
        messageList: Chat.messageList
      })
    }
  }
  
};


Core.processNamespace(global); // просто вызов, чтобы включить все объекты в контекст и начать работу
