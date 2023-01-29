import { Server, Socket } from "socket.io";
import { RESTServer } from "./RESTServer";
export interface SocketHandler<T> {
  event: string;
  sendUser: boolean;
  run: (
    user?: T,
    ...args: any[]
  ) => //   next: NextFunction,
  void | Promise<void> | any | Promise<any>;
}
export type SocketServerOptions = {
  server: RESTServer;
  getUser?: (req: Socket) => Promise<any> | any;
  forceAuth?: boolean;
  authCheck?: (req: Socket) => Promise<boolean> | boolean;
  port: number;
  key?: string;
  cert?: string;
};
export class SocketServer {
  socketServer: Server;
  handlers: Map<string, SocketHandler<any>>;
  getUser?: (req: Socket) => Promise<any>;
  forceAuth?: boolean;
  authCheck?: (req: Socket) => Promise<boolean> | boolean;
  socketListeners: Map<Socket, (event: string, ...args: any[]) => void>;
  constructor(opts: SocketServerOptions) {
    this.socketServer = new Server(opts.server.server);
    this.handlers = new Map();
    this.forceAuth = opts.forceAuth;
    this.authCheck = opts.authCheck;
    this.socketListeners = new Map();
    this.getUser = opts.getUser;
    this.socketServer.on("connection", this.socketConnect.bind(this));
  }
  async socketConnect(socket: Socket) {
    if (this.forceAuth) {
      const auth = await this.authCheck?.(socket);
      if (!auth) {
        socket.disconnect();
        this.socketListeners.delete(socket);
        return;
      }
    }
  }
  async listenToSocket<T>(socket: Socket) {
    const func = this.handleSocket.bind(this, socket);
    socket.onAny(func);
    this.socketListeners.set(socket, func);
  }
  async handleSocket<T>(socket: Socket, event: string, ...args: any[]) {
    const handler = this.handlers.get(event);
    if (!handler) {
      return;
    }
    if (handler.sendUser) {
      const user = await this.getUser?.(socket);
      return handler.run(user, ...args);
    }
    return handler.run(...args);
  }
  addHandler<T>(handler: SocketHandler<T>) {
    this.handlers.set(handler.event, handler);
  }
  removeHandler(handler: SocketHandler<any>) {
    this.handlers.delete(handler.event);
  }
  removeHandlerByEvent(event: string) {
    this.handlers.delete(event);
  }
}
