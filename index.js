const mysql = require('mysql');


let settings;
let connection;
module.exports = {
    /**
     * 根据node-red的配置初始化数据库连接
     * @param {object} nrsettings 
     * @returns 
     */
    init: function(nrsettings) {
        settings = nrsettings.mysqlSettings || {};
        if (!settings) {
            var err = Promise.reject("No mysqlSettings settings found");
        }
        return new Promise(function(resolve, reject) {
            let pool = mysql.createPool({
                host: settings.host,
                user: settings.user,
                password: settings.password,
                database: settings.database
            });
            pool.getConnection(function(err, conn) {
                if (err) {
                    reject(err);
                } else {
                    console.log("mysql connected");
                    connection = conn;
                    resolve(connection);
                }
            });       
        });
    },
    /**
     * 获取正在执行中的流
     * @returns 
     */
    getFlows: function() {
        return new Promise(function(resolve, reject) {
            console.log("getFlows");
            connection.query("SELECT id, flows FROM node_red_flows", function(err, rows) {
                if (err) {
                    reject(err);
                } else if (rows.length > 0) {
                    resolve(JSON.parse(rows[0].flows));
                }else {
                    resolve([]);
                }
            });
        });
    },
    saveFlows: function(flows) {
        return new Promise(function(resolve, reject) {
            console.log("saveFlows");
            connection.query("DELETE FROM node_red_flows");
            connection.query("INSERT INTO node_red_flows(flows) VALUES(?)", [JSON.stringify(flows)], function(err, rows) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    },
    getCredentials: function() {
        return new Promise(function(resolve, reject) {
            console.log("getCredentials");
            connection.query("SELECT id, credentials FROM node_red_credentials", function(err, rows) {
                if (err) {
                    reject(err);
                } else if (rows.length > 0){
                    resolve(JSON.parse(rows[0].credentials));
                }else {
                    resolve([]);
                }
            });
        });
    },
    saveCredentials: function(credentials) {
        return new Promise(function(resolve, reject) {
            connection.query("DELETE FROM node_red_credentials");
            connection.query("INSERT INTO node_red_credentials(credentials) VALUES(?)", [JSON.stringify(credentials)], function(err, rows) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    },
    getSettings: function() {
        return new Promise(function(resolve, reject) {
            console.log("getSettings");
            connection.query("SELECT id, settings FROM node_red_settings", function(err, rows) {
                if (err) {
                    reject(err);
                } else if (rows.length > 0) {
                    resolve(JSON.parse(rows[0].settings));
                }else {
                    resolve([]);
                }
            });
        });
    },
    saveSettings: function(settings) {
        return new Promise(function(resolve, reject) {
            connection.query("DELETE FROM node_red_settings");
            connection.query("INSERT INTO node_red_settings (settings) VALUES(?)", [JSON.stringify(settings)], function(err, rows) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    },
    getSessions: function() {
        return new Promise(function(resolve, reject) {
            console.log("getSettings");
            connection.query("SELECT id, sessions FROM node_red_sessions", function(err, rows) {
                if (err) {
                    reject(err);
                } else if (rows.length > 0){
                    resolve(JSON.parse(rows[0].sessions));
                }else {
                    resolve([]);
                }
            });
        });
    },
    saveSessions: function(sessions) {
        connection.query("DELETE FROM node_red_sessions");
        return new Promise(function(resolve, reject) {
            connection.query("INSERT INTO node_red_sessions(sessions) VALUES(?)", [JSON.stringify(sessions)], function(err, rows) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    },
    /**
     * 
     * @param {string} type the type of library entry, eg flows, functions, templates
     * @param {string} name the pathname of the entry to return
     * @returns {object}
     */
    getLibraryEntry: function(type, name) {
        //console.log("type:%s, name=%s",type, name);
        name = name == "" ? "/" : name.substring(0,1) != "/" ? "/" + name: name;
        return new Promise(function(resolve, reject) {
            connection.query("SELECT id, type, name, meta, body FROM node_red_libraries WHERE type = ? AND name = ?", [type, name], function(err, rows) {
                if (err) {
                    reject(err);
                } else if(rows.length > 0) {
                    resolve(JSON.parse(rows[0].body));
                }else {
                    // not found record in mysql
                    // 查询以name开头的记录
                    connection.query("SELECT id, type, name, meta, body FROM node_red_libraries WHERE type = ? AND name LIKE ?", 
                    [type, name + "%"], function(err, rows) {
                        //console.log("rows:", rows);
                        if (err) {
                            reject(err);
                        } else if(rows.length > 0) {
                            let dirs = [];
                            const files = [];
                            rows.forEach(function(row) {
                                // 去掉前面的目录，只保留最后文件名+后缀
                                let fileName = row.name;
                                fileName = fileName.replace(name, "");
                                if(fileName.indexOf("/") == -1) {
                                    // 说明找的是文件
                                    let f = JSON.parse(row.meta) ||  {};
                                    f.fn = fileName;
                                    files.push(f);
                                }else {
                                    // 说明找的是目录
                                    fileName = fileName.substring(0, fileName.indexOf("/"));
                                    dirs.push(fileName);
                                }
                            });
                            //console.log("dirs:",dirs);
                            //console.log("files:",files);
                            dirs = Array.from(new Set(dirs));
                            dirs = dirs.concat(files);
                            //console.log("没有报错呀，dirs:",dirs);
                            resolve(dirs);
                        }else {
                            resolve([]);
                        }
                    });
                }
            });
        });
    },

    /**
     * 
     * @param {string} type 
     * @param {string} name 
     * @param {object} meta 
     * @param {object} body 
     */
    saveLibraryEntry: function(type, name, meta, body) {
        return new Promise(function(resolve, reject) {
            //去除路径中的// 保留为/
            name = name.split("/").filter(Boolean).join("/");
            // 在最前面加上/
            if (name != "" && name.substring(0,1) != "/") {
                name = "/" + name;
            }
            // 判断是否已经存在 如果存在则更新，否则插入
            connection.query("SELECT id FROM node_red_libraries WHERE name = ?", [name], function(err, rows) {
                if (err) {
                    reject(err);
                } else if(rows.length > 0) {
                    // 更新
                    connection.query("UPDATE node_red_libraries SET type = ?, name = ?, meta = ?, body = ? WHERE name = ?", 
                    [type, name, JSON.stringify(meta), body, name], function(err, rows) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                }else {
                    // 插入
                    connection.query("INSERT INTO node_red_libraries (type, name, meta, body) VALUES (?, ?, ?, ?)", 
                    [type, name, JSON.stringify(meta), body], function(err, rows) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                }
            });
        });
    }
}