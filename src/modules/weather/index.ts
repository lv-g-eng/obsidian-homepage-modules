import { MarkdownPostProcessorContext, MarkdownRenderChild, requestUrl } from "obsidian";
import { BaseRenderChild, HMModule, ModuleContext } from "../../core/module";
import { createCard } from "../../ui/components/Card";

const WMO: Record<number, string> = {
  0: "☀️ 晴",
  1: "🌤 多云转晴",
  2: "⛅ 多云",
  3: "☁️ 阴",
  45: "🌫 雾",
  48: "🌫 雾凇",
  51: "🌦 小毛雨",
  61: "🌧 小雨",
  63: "🌧 中雨",
  65: "🌧 大雨",
  71: "🌨 小雪",
  73: "🌨 中雪",
  75: "❄️ 大雪",
  80: "🌧 阵雨",
  95: "⛈ 雷雨",
};

class WeatherChild extends BaseRenderChild {
  onload(): void {
    const { body } = createCard(this.containerEl, {
      title: this.params.title ?? "天气",
      icon: "cloud-sun",
      cls: "hm-weather",
    });
    const out = body.createDiv({ cls: "hm-weather-out", text: "加载中…" });
    void this.fetchWeather(out);
  }

  private async fetchWeather(out: HTMLElement): Promise<void> {
    const lat = this.params.lat ?? "31.23"; // 默认上海
    const lon = this.params.lon ?? "121.47";
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3`;
    try {
      const resp = await requestUrl({ url, throw: false });
      if (resp.status !== 200) {
        out.setText("天气获取失败");
        return;
      }
      const j = resp.json;
      const cur = j.current;
      out.empty();
      out.createDiv({
        cls: "hm-weather-now",
        text: `${WMO[cur.weather_code] ?? "天气"} ${Math.round(cur.temperature_2m)}°C`,
      });
      const daily = j.daily;
      const days = out.createDiv({ cls: "hm-weather-days" });
      for (let i = 0; i < (daily.time?.length ?? 0); i++) {
        const d = days.createDiv({ cls: "hm-weather-day" });
        d.createSpan({
          cls: "hm-muted",
          text: i === 0 ? "今天" : daily.time[i].slice(5),
        });
        d.createSpan({
          text: `${Math.round(daily.temperature_2m_min[i])}~${Math.round(
            daily.temperature_2m_max[i]
          )}°`,
        });
      }
    } catch (e) {
      out.setText("天气获取失败：" + (e as Error).message);
    }
  }
}

export const weatherModule: HMModule = {
  id: "weather",
  lang: "weather",
  category: "dashboard",
  displayName: "天气",
  description: "Open-Meteo 免密钥天气，block 可写 lat/lon 指定地点。",
  premium: true,
  createRenderChild(
    source: string,
    el: HTMLElement,
    _mctx: MarkdownPostProcessorContext,
    ctx: ModuleContext
  ): MarkdownRenderChild {
    return new WeatherChild(el, source, ctx);
  },
  defaultBlock(): string {
    return "title: 天气\nlat: 31.23\nlon: 121.47";
  },
};
