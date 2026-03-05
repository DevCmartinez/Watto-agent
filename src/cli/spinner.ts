import { c } from "./ui";
export class Spinner {
  private frames = ["|", "/", "-", "\\"];
  private timer: NodeJS.Timeout | null = null;
  private frame = 0;
  private msg: string;
  constructor(msg = "Procesando") {
    this.msg = msg;
  }
  start() {
    process.stdout.write("\x1B[?25l");
    this.timer = setInterval(() => {process.stdout.write(c.thinking(`\r ${this.frames[this.frame++ % 4]}${this.msg}...`),);}, 100);
  }
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    process.stdout.write("\r" + " ".repeat(50) + "\r");
    process.stdout.write("\x1B[?25h");
  }
}
