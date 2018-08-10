import React, { Component, Fragment } from 'react';
import { v4 } from 'uuid';
import Pusher from 'pusher-js';

class Canvas extends Component {
    constructor(props) {
        super(props);
        this.pusher = new Pusher('9a365f6858986b0444f0', {
            cluster: 'ap1',
            encrypted: true
        });
        this.state = {
            drawer: []
        }
    }

    isPainting = false;
    //Different stroke styles to be used for user and guest
    userStrokeStyle = '#EE92C2';
    guestStrokeStyle = '#F0C987';
    line = [];

    // v4 creates a unique id for each user. We used this since there's no auth to tell users apart
    userId = v4();
    prevPos = { offsetX: 0, offsetY: 0 };

    getRandomColor = () => {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color
    }

    onMouseDown = (event) => {
        this.isPainting = true;
        this.prevPos = this.getOffSets(event);
        this.timeOut = setInterval(() => {
            if (this.isPainting) {
                this.sendPaintDate();
            }
        }, 2000);
    };

    onMouseMove = (event) => {
        if (this.isPainting) {
            const offSetData = this.getOffSets(event);

            //Set the start and stop position of the paint event.
            const positionData = {
                start: { ...this.prevPos },
                stop: { ...offSetData }
            };

            //Add the position to the line array
            this.line = this.line.concat(positionData);
            this.paint(this.prevPos, offSetData, this.userStrokeStyle);
        };
    };

    getOffSets = (event) => {
        let offsetX, offsetY;
        if (event.type === 'touchmove') {
            const { clientX, clientY } = event.touches[0];
            const { offsetLeft, offsetTop } = event.touches[0].target;
            offsetX = clientX - offsetLeft;
            offsetY = clientY - offsetTop;
        } else {
            const { nativeEvent } = event;
            offsetX = nativeEvent.offsetX;
            offsetY = nativeEvent.offsetY;
        }
        return { offsetX, offsetY };
    }

    endPaintEvent = () => {
        if (this.isPainting) {
            this.isPainting = false;
            clearInterval(this.timeOut);
            this.sendPaintDate();
        }
    }

    clearBoard = async () => {
        const body = {
            line: 'clear',
            userId: this.userId
        };

        //We use the native fetch API to make resquests to the server
        const req = await fetch('/paint', {
            method: 'post',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        await req.json();
        this.line = [];
    }

    paint = (prevPos, currPos, strokeStyle) => {
        const { offsetX, offsetY } = currPos;
        const { offsetX: x, offsetY: y } = prevPos;

        this.ctx.beginPath();
        this.ctx.strokeStyle = strokeStyle;

        //Move the prevPosition of the mouse
        this.ctx.moveTo(x, y);

        //Draw a line to the current position of the mouse
        this.ctx.lineTo(offsetX, offsetY);

        //Visualize the line using the strokeStyle
        this.ctx.stroke();
        this.prevPos = { offsetX, offsetY };
    }

    sendPaintDate = async () => {
        const body = {
            line: this.line,
            draw: {
                userId: this.userId,
                userName: this.userName
            }
        };

        //We use the native fetch API to make resquests to the server
        const req = await fetch('http://172.20.10.4:4000/paint', {
            method: 'post',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        await req.json();
        this.line = [];
    }

    async componentDidMount() {
        this.canvas.width = 370;
        this.canvas.height = 450;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.lineJoin = 'round';
        this.ctx.lineCap = 'round';
        this.ctx.lineWidth = 5;

        const { drawer } = this.state;
        while (!this.userName) {
            this.userName = await window.prompt('暱稱');
        };
        drawer.push({ userId: this.userId, userName: this.userName, color: '#EE92C2' });
        this.setState(drawer);

        //Pusher
        const channel = this.pusher.subscribe('painting');
        channel.bind('draw', ({ draw, line }) => {
            if (line === 'clear') {
                this.ctx.clearRect(0, 0, 800, 800);
            } else {
                if (draw.userId !== this.userId) {
                    const hasColor = drawer.find(obj => obj.userId === draw.userId);
                    let color;
                    if (!hasColor) {
                        color = this.getRandomColor();
                        draw.color = color;
                        drawer.push(draw);
                        this.setState(drawer);
                    } else {
                        color = hasColor.color;
                    }

                    line.forEach(position => {
                        this.paint(position.start, position.stop, color);
                    });
                }
            }
        });
    }

    render() {
        const { drawer } = this.state;
        return (
            <Fragment>
                <div style={{ display: 'flex', flexDirection: 'row' }}>
                    {drawer.map(({ userId, userName, color }) => (
                        <div key={userId} className={'user'} style={{ background: color }}>{userName}</div>
                    ))}
                </div>
                <button onClick={this.clearBoard}>Clear</button>
                <canvas
                    // We use the ref attribute to get direct access to the canvas element.
                    ref={(ref) => (this.canvas = ref)}
                    style={{ background: 'black' }}
                    onMouseDown={this.onMouseDown}
                    onMouseLeave={this.endPaintEvent}
                    onMouseUp={this.endPaintEvent}
                    onMouseMove={this.onMouseMove}
                    onTouchStart={this.onMouseDown}
                    onTouchEnd={this.endPaintEvent}
                    onTouchMove={this.onMouseMove}
                />
            </Fragment>
        );
    }
}

export default Canvas;