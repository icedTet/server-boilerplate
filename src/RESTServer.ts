import cors from "cors";
import express, { NextFunction, Express, Request, Response } from "express";
import * as fsp from "fs/promises";
import { Server } from "http";
import https from "https";
export interface RESTHandler<T> {
  path: string;
  method: RESTMethods;
  sendUser: boolean;
  run: (
    req: Request,
    res: Response,
    next: NextFunction,
    user?: T
  ) => void | Promise<void> | any | Promise<any>;
}
export enum RESTMethods {
  GET = "get",
  POST = "post",
  PUT = "put",
  DELETE = "delete",
  PATCH = "patch",
  OPTIONS = "options",
  HEAD = "head",
  CONNECT = "connect",
  TRACE = "trace",
  ALL = "all",
}
export type RESTServerOptions = {
  getUser?: (req: Request) => Promise<any>;
  port: number;
  key?: string;
  cert?: string;
};
export class RESTServer {
  express: Express;
  server: Server;
  handlers: Set<RESTHandler<any>>;
  getUser?: (req: Request) => Promise<any> | any;
  constructor(opts: RESTServerOptions) {
    this.express = express();
    this.handlers = new Set();
    if (opts.getUser) {
      this.getUser = opts.getUser;
    }
    this.express.use(express.json());
    this.express.use(cors());
    if (opts.key && opts.cert) {
      const httpsServer = https.createServer(
        {
          key: opts.key,
          cert: opts.cert,
        },
        this.express
      );
      this.server = httpsServer.listen(opts.port);
    } else {
      this.server = this.express.listen(opts.port);
    }
  }
  setGetUser(getUser: (req: Request) => Promise<any>) {
    this.getUser = getUser;
  }
  addHandler<T>(handler: RESTHandler<T>) {
    this.handlers.add(handler);
    this.express[handler.method](handler.path, async (req, res, next) => {
      if (!this.handlers.has(handler)) return next();
      try {
        if (handler.sendUser) {
          const user = await this.getUser?.(req);
          await handler.run(req, res, next, user);
        } else {
          await handler.run(req, res, next);
        }
      } catch (e) {
        next(e);
      }
    });
  }
  removeHandler(handler: RESTHandler<any>) {
    this.handlers.delete(handler);
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
            const handler = module.default as RESTHandler<any>;
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
}
