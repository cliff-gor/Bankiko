package ke.cliffgor.bankiko.common.config;

import io.netty.channel.ChannelOption;
import io.netty.handler.timeout.ReadTimeoutHandler;
import io.netty.handler.timeout.WriteTimeoutHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

@Configuration
@RequiredArgsConstructor
public class WebClientConfig {

    private final BankikoProperties properties;

    @Bean("fineractWebClient")
    public WebClient fineractWebClient() {
        BankikoProperties.Fineract cfg = properties.getFineract();

        HttpClient httpClient = HttpClient.create()
            .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, cfg.getConnectTimeoutSeconds() * 1000)
            .responseTimeout(Duration.ofSeconds(cfg.getReadTimeoutSeconds()))
            .doOnConnected(conn -> conn
                .addHandlerLast(new ReadTimeoutHandler(cfg.getReadTimeoutSeconds(), TimeUnit.SECONDS))
                .addHandlerLast(new WriteTimeoutHandler(cfg.getConnectTimeoutSeconds(), TimeUnit.SECONDS)));

        return WebClient.builder()
            .baseUrl(cfg.getBaseUrl())
            .defaultHeader("Fineract-Platform-TenantId", cfg.getTenant())
            .defaultHeaders(headers -> headers.setBasicAuth(cfg.getUsername(), cfg.getPassword()))
            .clientConnector(new ReactorClientHttpConnector(httpClient))
            .build();
    }

    @Bean("mpesaWebClient")
    public WebClient mpesaWebClient() {
        String baseUrl = properties.getMpesa().getBaseUrl();

        HttpClient httpClient = HttpClient.create()
            .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 10_000)
            .responseTimeout(Duration.ofSeconds(30));

        return WebClient.builder()
            .baseUrl(baseUrl)
            .clientConnector(new ReactorClientHttpConnector(httpClient))
            .build();
    }
}
