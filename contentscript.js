(function(){

	function ajax(o) {
		var xhr = new XMLHttpRequest();

		xhr.onreadystatechange = function() {
			if (xhr.readyState == 4) {
				var result, error = false;
				if ((xhr.status >= 200 && xhr.status < 300) || (xhr.status == 0)) {
					result = xhr.responseText;
					o.success && o.success(result, xhr, o);
				} else {
					o.error && o.error(null, 'error', xhr, o);
				}
			}
		};

		xhr.open(o.type || 'GET', o.url, true);

		if (o.type.toLowerCase() == 'post') {
			xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
		}

		xhr.send(o.data || null);
	}

	function list2array(nodeList){
		return Array.prototype.slice.call(nodeList, 0)
	}

	//用户信息
	var info = {
		userId : false,
		requestToken : false,
		_rtk : false
	};

	var hasNote = false;

	function ajaxError(){
		alert('请求失败,可能是以下问题所导致：\n1、网络问题\n2、您中途退出登录\n3、您中途切换账号\n如果是2、3的原因，请登录人人网(记住登录状态)刷新微博页面重试！')
	}

	//获取用户id
	function getUserId(){
		ajax({
			url : 'http://notify.renren.com/wpi/getfullrecentfriends.do?time=' + Date.now(),
			type : 'get',
			success : function(r){
				if(r.indexOf('failure') != -1){
					if(!hasNote) {
						alert('请登录人人网并选择记住登录状态！');
						hasNote = true;

						chrome.extension.sendRequest({type : 'opentag'}, function(response) {
						});

					}
					return;
				}

				temp = JSON.parse(r);
				info.userId = temp.userId;
			},
			error : ajaxError
		})
	}

	//获取requestionToken和_rtk信息
	function getInfo(){
		ajax({
			url : 'http://renren.com?time=' + Date.now(),
			type : 'get',
			success : function(r){
				localStorage.temp = r;
				var requestToken = /get_check:'(.*?)'/.exec(localStorage.temp)[1];
				var _rtk = /get_check_x:'(.*?)'/.exec(localStorage.temp)[1];
				
				info.requestToken = requestToken;
				info._rtk = _rtk;
			},
			error : ajaxError
		})
	}

	//转发纯文字
	function sendMsg(msg, callback){
		ajax({
			url : 'http://shell.renren.com/' + info.userId + '/status',
			type : 'post',
			data : ['content=', encodeURIComponent(msg), '&hostid=', info.userId, '&requestToken=', info.requestToken, '&_rtk=', info._rtk, '&channel=renren'].join(''),
			success : function(r){
				callback(r);
			},
			error : ajaxError
		})
	}

	//转发视频
	function sendVideo(msg, videoLink, callback){
		ajax({
			url : 'http://shell.renren.com/' + info.userId + '/url/parse',
			type : 'post',
			data : ['comment=', encodeURIComponent(msg), '&link=', videoLink, '&hostid=', info.userId, '&requestToken=', info.requestToken, '&_rtk=', info._rtk].join(''),
			success : function(r){
				if (r.indexOf('flashUrl') == -1) {
					alert('请求失败，请重试！');
					return;
				};

				var json = JSON.parse(r);
				ajax({
					url : 'http://shell.renren.com/' + info.userId + '/share',
					type : 'post',
					data : ['comment=', encodeURIComponent(msg), '&link=', videoLink, '&type=', json.type, '&url=', videoLink, '&thumbUrl=', json.thumbUrl, '&meta=', '"' + json.meta.replace(/\\/gim,'\\\\').replace(/"/gim,'\\"') + '"', '&summary=', json.summary, '&title=', json.title, '&hostid=', info.userId, '&requestToken=', info.requestToken, '&_rtk=', info._rtk, '&channel=renren'].join(''),
					success : function(r){
						callback(r);
					},
					error : ajaxError
				})
			},
			error : ajaxError
		})
	}

	//转发图片
	function sendImage(msg, imageLink, callback){
		ajax({
			url : 'http://photo.renren.com/photo/facade/common/album/publisher',
			type : 'get',
			success : function(r){
				if(r.indexOf('albumId') == -1){
					alert('请求失败，请重试！');
					return;
				}

				var album = JSON.parse(r);
				var albumId = album.albumId;

				ajax({
					url : 'http://widget.renren.com/dialog/forward/post',
					type : 'post',
					data : ['title=', encodeURIComponent(msg), '&content=', encodeURIComponent(msg), '&type=photo&url=&api_key=7f96c3fbe7a8400d96e2147780d1734f&appId=182707&from=&originType=photo&image=', imageLink, '&albumId=', albumId, '&_rtk=', info._rtk].join(''),
					success : function(r){
						callback(r);
					},
					error : ajaxError
				})

			},
			error : ajaxError
		})
	}

	//获取必要的信息
	function getReady(callback){
		setTimeout(function(){
			if(!info.userId || !info.requestToken || !info._rtk){
				if(!info.userId){
					getUserId();
				}
				else if(!info.requestToken){
					getInfo();
				}
				setTimeout(arguments.callee,100);
				return;
			}

			callback();
		},50)
	}


	//在每条微博后面绑定“人人转发”按钮
	function bindIcon(){
		var has = [],
			href_now = window.location.href,
			//首页，个人主页，他人页的展示区域id
			ids = ['pl_content_homeFeed', 'pl_content_myFeed', 'pl_content_hisFeed'];
		addIcon();

		document.body.addEventListener('click', function(e){
			var el = e.target;
			if(el.nodeName.toLowerCase() == 'a' && el.className == 'wb2rr'){
				while(!el.hasAttribute('action-type')){
					el = el.parentNode;
				}

				var feedContent;

				//判断是在哪一个页面
				ids.forEach(function(i){
					if(document.getElementById(i)){
						feedContent = getFeedContent(el, i);
					}
				})

				//转发纯文字内容
				if (feedContent.content && !feedContent.image && !feedContent.video) {
					sendMsg(feedContent.content + (feedContent.author ? '  转自新浪微博 @' + feedContent.author: ''), function(r) {
						if(r.toLowerCase().indexOf('updatestatusid') != -1){
							alert('转发成功！');
						}
						else{
							ajaxError();
						}
					});
				}

				//转发视频内容
				else if (feedContent.content && feedContent.video) {
					sendVideo(feedContent.content + (feedContent.author ? '  转自新浪微博 @' + feedContent.author: ''), feedContent.video, function(r){
						if(r.toLowerCase().indexOf('ok') != -1){
							alert('转发成功！');
						}
						else{
							ajaxError();
						}
					});
				}

				//转发图片
				else if(feedContent.content && feedContent.image){
					sendImage(feedContent.content + (feedContent.author ? '  转自新浪微博 @' + feedContent.author: ''), feedContent.image, function(r){
						if (r.toLowerCase() == '{}'){
							alert('转发成功！');
						}
						else{
							ajaxError();
						}
					})
				}


			}
		}, false)

		window.addEventListener('scroll', function(e){
			addIcon();
		}, false)

		ids.forEach(function(i){
			if(!document.getElementById(i)) return;
			document.getElementById(i).addEventListener('DOMSubtreeModified', function(e){
				var el = e.target;
				if (el.nodeName.toLowerCase() == 'div') {
					var node_type = el.getAttribute('node-type');
					if(!node_type) return;
					if(node_type.toLowerCase() == 'feed_list' && href_now != window.location.href){
						href_now = window.location.href;
						has = [];
						addIcon();
					}
				};
			}, false)
		})
		

		function addIcon(){
			var feedList = document.getElementsByClassName('feed_list');

			for(var i = feedList.length-1; i >= 0; i--){
				var mid = feedList[i].getAttribute('mid');
				if (!mid) continue;
				if(has.indexOf(mid) != -1) continue;
				has.push(mid);

				if(feedList[i].hasAttribute('isforward')){
					continue;
				}

				var p = list2array(feedList[i].getElementsByClassName('info'));
				p = p.filter(function(i){
					return i.nodeName.toLowerCase() == 'p'
				})[0];

				var span = p.getElementsByTagName('span')[0];
				span.innerHTML += '<i class="W_vline">|</i><a class="wb2rr" href="javascript:;" style="color:#369">人人转发</a>';
			}
		}

		//获取微博信息
		function getFeedContent(el, idStr){
			var author, content, image, video,
			//微博的内容结构
			feedContent = {
				author : false,
				content : false,
				image : false,
				video : false
			};

			//获取微博内容
			content = el.getElementsByClassName('content')[0];
			var p = list2array(content.getElementsByTagName('P'));
			p = p.filter(function(i){
				return i.hasAttribute('node-type') && i.getAttribute('node-type') == 'feed_list_content';
			})[0]

			if(idStr == ids[0]){
				author = p.getElementsByTagName('A')[0];
				if(author && author.innerHTML) feedContent.author = author.innerHTML;

				var em = p.getElementsByTagName('EM')[0];
				content = em.innerHTML;
			}
			else if(idStr == ids[1] || idStr == ids[2]){
				var preTemp = (idStr == ids[1] ? 'my' : 'his');
				author = document.getElementById('pl_content_' + preTemp + 'PersonalInfo');
				author = author.firstElementChild.firstElementChild.firstElementChild.innerText;
				feedContent.author = author;

				content = p.innerHTML;
			}
			content = content.replace(/<img(.*?)type="face">/,'');
			content = content.replace(/<a.*?\/a>/gim, function($1){
				if($1.indexOf('@') != -1) return /(@.*?)</.exec($1)[1];
				else if($1.indexOf('#') != -1 || $1.indexOf('title') == -1) return '';
				else return /title="(.*?)"/.exec($1)[1];
			});

			feedContent.content = content;

			var ul = list2array(el.getElementsByClassName('piclist'));
			if (ul.length > 0){
				ul = ul.filter(function(i){
					return i.hasAttribute('node-type') && i.getAttribute('node-type') == 'feed_list_media_prev';
				})[0];

				//获取图片信息
				image = list2array(ul.getElementsByTagName('IMG'));
				image = image.filter(function(i){
					return i.className == 'bigcursor' && i.hasAttribute('node-type') && i.getAttribute('node-type') == 'feed_list_media_bgimg';
				});
				if (image.length) {
					image = image[0];
					feedContent.image = image.src.replace('thumbnail', 'bmiddle');
				};

				//获取视频信息
				video = list2array(ul.getElementsByTagName('LI'));
				video = video.filter(function(i){
					return i.hasAttribute('action-type') && i.getAttribute('action-type') == 'feed_list_media_video' && i.hasAttribute('action-data');
				})
				if(video.length){
					video = video[0];
					var src = video.getAttribute('action-data');
					var temp = /&full_url=(.*)/.exec(src);
					if(temp.length < 1) return;
					feedContent.video = decodeURIComponent(temp[1]);
				}
			}

			return feedContent;
		}

	}



	getReady(function(){
		bindIcon();
	});

})()