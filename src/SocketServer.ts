import { Server, Socket } from "socket.io";
import { RESTServer } from "./RESTServer";
import * as fsp from "fs/promises";
export interface SocketHandler<T> {
  event: string;
  sendUser: boolean;
  run: (
    socket: Socket,
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
      return handler.run(socket, user, ...args);
    }
    return handler.run(socket, null, ...args);
  }
  addHandler<T>(handler: SocketHandler<T>) {
    this.handlers.set(handler.event, handler);
  }
  import(directory: string) {
    let failedDirs = [] as string[];
    this._import(directory, failedDirs);
    return failedDirs;
  }
  private async _import(path: string, failedImports: string[]): Promise<void> {
    await Promise.all(
      (
        await fsp.readdir(path)
      ).map(async (file) => {
        if ((await fsp.lstat(`${path}/${file}`)).isDirectory()) {
          console.log(`Importing Folder ${path}/${file}`);
          return await this._import(`${path}/${file}`, failedImports);
        }
        if (!file.endsWith(".ts") && !file.endsWith(".js")) {
          return;
        }
        import(`${path}/${file}`)
          .then((module) => {
            console.log(`${file} imported`);
            const handler = module.default as SocketHandler<any>;
            if (!handler) {
              return failedImports.push(`${file} is not a REST handler`);
            }
            console.log(handler);
            this.addHandler(handler);
            console.log(`Loaded ${file}`);
          })
          .catch((err) => {
            console.error(`Failed to import ${file}`);
            console.error(err);
            failedImports.push(`${file} failed to import`);
          });
      })
    );
  }
  removeHandler(handler: SocketHandler<any>) {
    this.handlers.delete(handler.event);
  }
  removeHandlerByEvent(event: string) {
    this.handlers.delete(event);
  }
}
